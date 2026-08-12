"use server";

import { database } from "@repo/database";
import { revalidatePath } from "next/cache";

function parseDateOnly(dateStr: string) {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

function todayDateOnly() {
  return parseDateOnly(new Date().toISOString().slice(0, 10));
}

// Business rule: closed Sat/Sun, plus any date registered in the `holidays`
// table. The date is a plain calendar date (no time component), so the UTC
// day-of-week is the same as the KST day-of-week.
async function isClosedDay(date: Date) {
  const day = date.getUTCDay();
  if (day === 0 || day === 6) {
    return true;
  }
  const holiday = await database.holiday.findUnique({ where: { date } });
  return holiday !== null;
}

export async function getTimeSlots() {
  return database.timeSlot.findMany({ orderBy: { startTime: "asc" } });
}

export async function getAvailability(dateStr: string) {
  const date = parseDateOnly(dateStr);

  if (await isClosedDay(date)) {
    return { closed: true, bookedSlotIds: [] as string[] };
  }

  const reservations = await database.reservation.findMany({
    where: { date, status: { not: "CANCELLED" } },
    select: { slotId: true },
  });

  return { closed: false, bookedSlotIds: reservations.map((r) => r.slotId) };
}

// month is "YYYY-MM". Returns, for the visible calendar month, which dates
// have every time slot booked ("마감") and which are holidays, so the
// calendar can mark them without a per-date round trip.
export async function getMonthAvailability(month: string) {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1));

  const [totalSlots, reservations, holidays] = await Promise.all([
    database.timeSlot.count(),
    database.reservation.findMany({
      where: { date: { gte: start, lt: end }, status: { not: "CANCELLED" } },
      select: { date: true, slotId: true },
    }),
    database.holiday.findMany({
      where: { date: { gte: start, lt: end } },
      select: { date: true },
    }),
  ]);

  const bookedSlotsByDate = new Map<string, Set<string>>();
  for (const reservation of reservations) {
    const key = reservation.date.toISOString().slice(0, 10);
    const slotIds = bookedSlotsByDate.get(key) ?? new Set<string>();
    slotIds.add(reservation.slotId);
    bookedSlotsByDate.set(key, slotIds);
  }

  const fullDates = [...bookedSlotsByDate.entries()]
    .filter(([, slotIds]) => totalSlots > 0 && slotIds.size >= totalSlots)
    .map(([dateStr]) => dateStr);

  const holidayDates = holidays.map((h) => h.date.toISOString().slice(0, 10));

  return { fullDates, holidayDates };
}

export interface CreateReservationInput {
  customerName: string;
  customerPhone: string;
  date: string;
  partySize: number;
  request?: string;
  slotId: string;
}

export type CreateReservationResult =
  | { success: true; reservationId: string }
  | { success: false; error: string };

const DUPLICATE_SLOT_ERROR =
  "죄송합니다. 해당 시간은 방금 예약되었습니다. 다른 시간대를 선택해주세요.";

function buildActiveSlotKey(dateStr: string, slotId: string) {
  return `${dateStr}_${slotId}`;
}

export async function createReservation(
  input: CreateReservationInput
): Promise<CreateReservationResult> {
  const date = parseDateOnly(input.date);

  if (await isClosedDay(date)) {
    return { success: false, error: "휴무일입니다. 다른 날짜를 선택해주세요." };
  }

  if (date.getTime() < todayDateOnly().getTime()) {
    return { success: false, error: "지난 날짜는 예약할 수 없습니다." };
  }

  const slot = await database.timeSlot.findUnique({
    where: { id: input.slotId },
  });
  if (!slot) {
    return { success: false, error: "올바르지 않은 시간대입니다." };
  }

  const customerName = input.customerName.trim();
  const customerPhone = input.customerPhone.trim();

  if (!(customerName && customerPhone)) {
    return { success: false, error: "이름과 연락처를 입력해주세요." };
  }

  if (
    !Number.isInteger(input.partySize) ||
    input.partySize < 1 ||
    input.partySize > 20
  ) {
    return { success: false, error: "인원 수를 확인해주세요 (1~20명)." };
  }

  // Re-check availability on the server right before writing — the client
  // may be looking at availability that's a few seconds stale (see the
  // polling in reservation-form.tsx).
  const alreadyBooked = await database.reservation.findFirst({
    where: { date, slotId: input.slotId, status: { not: "CANCELLED" } },
    select: { id: true },
  });
  if (alreadyBooked) {
    return { success: false, error: DUPLICATE_SLOT_ERROR };
  }

  try {
    const reservation = await database.reservation.create({
      data: {
        date,
        slotId: input.slotId,
        partySize: input.partySize,
        customerName,
        customerPhone,
        request: input.request?.trim() || undefined,
        // Enforced unique at the DB level (see schema.prisma) so that two
        // requests racing past the check above can't both succeed.
        activeSlotKey: buildActiveSlotKey(input.date, input.slotId),
      },
    });
    revalidatePath("/reservations");
    return { success: true, reservationId: reservation.id };
  } catch (error) {
    const isUniqueConstraintError =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002";

    if (isUniqueConstraintError) {
      return { success: false, error: DUPLICATE_SLOT_ERROR };
    }
    throw error;
  }
}
