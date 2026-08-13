// Plain (non-"use server") helpers shared between the booking flow's server
// actions and the check-reservation flow's server actions. A "use server"
// file may only export async functions, so this sync logic — especially the
// duplicate-prevention pieces the DB-level uniqueness constraint backstops —
// lives here once instead of risking drift between two copies.
import { database } from "@repo/database";

export function parseDateOnly(dateStr: string) {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

// `date` columns store UTC-midnight standing in for a KST calendar date, so
// "today" must be today's KST date — not the UTC date, which is still
// "yesterday" for the first 9 hours of each KST day.
export function todayDateOnly() {
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return parseDateOnly(kstNow.toISOString().slice(0, 10));
}

// Business rule: closed Sat/Sun, plus any date registered in the `holidays`
// table. The date is a plain calendar date (no time component), so the UTC
// day-of-week is the same as the KST day-of-week.
export async function isClosedDay(date: Date) {
  const day = date.getUTCDay();
  if (day === 0 || day === 6) {
    return true;
  }
  const holiday = await database.holiday.findUnique({ where: { date } });
  return holiday !== null;
}

export const DUPLICATE_SLOT_ERROR =
  "죄송합니다. 해당 시간대는 예약이 마감되었습니다(3팀 예약 완료). 다른 시간대를 선택해주세요.";

// How many teams can share a single date+slot. Fixed for every slot — there's
// no per-slot admin configuration for this.
export const SLOT_CAPACITY = 3;

export function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

// Assigns a 1-based `teamSlotIndex` seat (1..SLOT_CAPACITY) and runs `assign`
// with it — used for both creating a new reservation and moving an existing
// one to a new date+slot. Re-counts and retries on a unique-constraint race
// (two requests grabbing the same seat number concurrently) rather than
// failing outright, since a retry can still land a free seat as long as
// capacity hasn't actually been reached. `excludeReservationId` is for the
// "moving my own reservation" case, so the row doesn't count against itself.
const MAX_SEAT_ASSIGN_ATTEMPTS = SLOT_CAPACITY + 1;

export async function withSeatAssignment<T>(
  date: Date,
  slotId: string,
  excludeReservationId: string | undefined,
  assign: (teamSlotIndex: number) => Promise<T>
): Promise<{ result: T; success: true } | { success: false }> {
  for (let attempt = 0; attempt < MAX_SEAT_ASSIGN_ATTEMPTS; attempt++) {
    const count = await database.reservation.count({
      where: {
        date,
        slotId,
        status: { not: "CANCELLED" },
        ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
      },
    });
    if (count >= SLOT_CAPACITY) {
      return { success: false };
    }
    try {
      const result = await assign(count + 1);
      return { result, success: true };
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        continue;
      }
      throw error;
    }
  }
  return { success: false };
}
