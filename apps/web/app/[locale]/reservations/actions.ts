"use server";

import { database, type TimeSlot } from "@repo/database";
import { revalidatePath } from "next/cache";

const ALL_SLOTS: TimeSlot[] = [
  "SLOT_10_12",
  "SLOT_12_14",
  "SLOT_14_16",
  "SLOT_16_18",
  "SLOT_18_20",
  "SLOT_20_22",
];

function parseDateOnly(dateStr: string) {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

function todayDateOnly() {
  return parseDateOnly(new Date().toISOString().slice(0, 10));
}

// Business rule: closed Sat/Sun. The date is a plain calendar date (no time
// component), so the UTC day-of-week is the same as the KST day-of-week.
function isClosedDay(date: Date) {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

export async function getAvailability(dateStr: string) {
  const date = parseDateOnly(dateStr);

  if (isClosedDay(date)) {
    return { closed: true, bookedSlots: [] as TimeSlot[] };
  }

  const reservations = await database.reservation.findMany({
    where: { date },
    select: { timeSlot: true },
  });

  return { closed: false, bookedSlots: reservations.map((r) => r.timeSlot) };
}

export interface CreateReservationInput {
  date: string;
  timeSlot: string;
  partySize: number;
  customerName: string;
  customerPhone: string;
  request?: string;
}

export type CreateReservationResult =
  | { success: true; reservationId: string }
  | { success: false; error: string };

export async function createReservation(
  input: CreateReservationInput
): Promise<CreateReservationResult> {
  const date = parseDateOnly(input.date);

  if (isClosedDay(date)) {
    return { success: false, error: "주말은 휴무일입니다. 평일을 선택해주세요." };
  }

  if (date.getTime() < todayDateOnly().getTime()) {
    return { success: false, error: "지난 날짜는 예약할 수 없습니다." };
  }

  if (!ALL_SLOTS.includes(input.timeSlot as TimeSlot)) {
    return { success: false, error: "올바르지 않은 시간대입니다." };
  }

  const customerName = input.customerName.trim();
  const customerPhone = input.customerPhone.trim();

  if (!customerName || !customerPhone) {
    return { success: false, error: "이름과 연락처를 입력해주세요." };
  }

  if (!Number.isInteger(input.partySize) || input.partySize < 1 || input.partySize > 20) {
    return { success: false, error: "인원 수를 확인해주세요 (1~20명)." };
  }

  try {
    const reservation = await database.reservation.create({
      data: {
        date,
        timeSlot: input.timeSlot as TimeSlot,
        partySize: input.partySize,
        customerName,
        customerPhone,
        request: input.request?.trim() || undefined,
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
      return {
        success: false,
        error: "방금 다른 팀이 먼저 예약한 시간대입니다. 다른 시간을 선택해주세요.",
      };
    }
    throw error;
  }
}
