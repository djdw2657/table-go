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
  "죄송합니다. 해당 시간은 방금 예약되었습니다. 다른 시간대를 선택해주세요.";

export function buildActiveSlotKey(dateStr: string, slotId: string) {
  return `${dateStr}_${slotId}`;
}

export function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}
