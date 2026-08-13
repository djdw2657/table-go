"use server";

import { database } from "@repo/database";
import {
  DUPLICATE_SLOT_ERROR,
  isClosedDay,
  parseDateOnly,
  todayDateOnly,
  withSeatAssignment,
} from "../reservations/reservation-shared";
import { isWithinEditWindow } from "../reservations/reservation-time";
import { normalizePhoneDigits } from "../reservations/validation";

const NOT_FOUND_ERROR =
  "예약 정보를 찾을 수 없습니다. 예약번호와 연락처를 확인해주세요.";

export interface LookupData {
  customerName: string;
  date: string;
  id: string;
  partySize: number;
  request: string | null;
  reservationNumber: string;
  status: string;
  timeSlot: { displayName: string; id: string; startTime: string };
}

export type LookupResult =
  | { success: true; reservation: LookupData }
  | { success: false; error: string };

// Looks up by reservationNumber AND phone together — no accounts exist, so
// this pair is the only credential. Same generic error either way, so a
// guessed reservation number can't be used to probe for valid ones.
export async function lookupReservation(input: {
  phone: string;
  reservationNumber: string;
}): Promise<LookupResult> {
  const reservation = await database.reservation.findUnique({
    where: { reservationNumber: input.reservationNumber.trim().toUpperCase() },
    include: { timeSlot: true },
  });

  if (
    !reservation ||
    normalizePhoneDigits(reservation.customerPhone) !==
      normalizePhoneDigits(input.phone)
  ) {
    return { success: false, error: NOT_FOUND_ERROR };
  }

  return {
    success: true,
    reservation: {
      customerName: reservation.customerName,
      date: reservation.date.toISOString().slice(0, 10),
      id: reservation.id,
      partySize: reservation.partySize,
      reservationNumber: reservation.reservationNumber,
      request: reservation.request,
      status: reservation.status,
      timeSlot: {
        displayName: reservation.timeSlot.displayName,
        id: reservation.timeSlot.id,
        startTime: reservation.timeSlot.startTime,
      },
    },
  };
}

async function reauthenticate(input: {
  id: string;
  phone: string;
  reservationNumber: string;
}) {
  const reservation = await database.reservation.findUnique({
    where: { id: input.id },
    include: { timeSlot: true },
  });
  if (
    !reservation ||
    reservation.reservationNumber !==
      input.reservationNumber.trim().toUpperCase() ||
    normalizePhoneDigits(reservation.customerPhone) !==
      normalizePhoneDigits(input.phone)
  ) {
    return null;
  }
  return reservation;
}

export type MutationResult =
  | { success: true }
  | { success: false; error: string };

export async function cancelReservationByCustomer(input: {
  id: string;
  phone: string;
  reservationNumber: string;
}): Promise<MutationResult> {
  const reservation = await reauthenticate(input);
  if (!reservation) {
    return { success: false, error: NOT_FOUND_ERROR };
  }
  if (reservation.status === "CANCELLED") {
    return { success: false, error: "이미 취소된 예약입니다." };
  }
  if (!isWithinEditWindow(reservation.date, reservation.timeSlot.startTime)) {
    return {
      success: false,
      error: "예약 취소 가능 기간이 지났습니다. (예약 24시간 전까지 취소 가능)",
    };
  }

  await database.reservation.update({
    where: { id: reservation.id },
    data: { status: "CANCELLED", teamSlotIndex: null },
  });
  return { success: true };
}

export interface UpdateReservationInput {
  date: string;
  id: string;
  partySize: number;
  phone: string;
  request?: string;
  reservationNumber: string;
  slotId: string;
}

export async function updateReservationByCustomer(
  input: UpdateReservationInput
): Promise<MutationResult> {
  const reservation = await reauthenticate(input);
  if (!reservation) {
    return { success: false, error: NOT_FOUND_ERROR };
  }
  if (reservation.status === "CANCELLED") {
    return { success: false, error: "이미 취소된 예약입니다." };
  }
  // The 24h cutoff is checked against the ORIGINAL slot — you can't edit a
  // reservation that's already inside the cutoff, even to move it further out.
  if (!isWithinEditWindow(reservation.date, reservation.timeSlot.startTime)) {
    return {
      success: false,
      error: "예약 변경 가능 기간이 지났습니다. (예약 24시간 전까지 변경 가능)",
    };
  }

  const newDate = parseDateOnly(input.date);

  if (await isClosedDay(newDate)) {
    return { success: false, error: "휴무일입니다. 다른 날짜를 선택해주세요." };
  }
  if (newDate.getTime() < todayDateOnly().getTime()) {
    return { success: false, error: "지난 날짜는 예약할 수 없습니다." };
  }

  const slot = await database.timeSlot.findUnique({
    where: { id: input.slotId },
  });
  if (!slot) {
    return { success: false, error: "올바르지 않은 시간대입니다." };
  }
  if (
    !Number.isInteger(input.partySize) ||
    input.partySize < 1 ||
    input.partySize > 20
  ) {
    return { success: false, error: "인원 수를 확인해주세요 (1~20명)." };
  }

  const slotChanged =
    input.date !== reservation.date.toISOString().slice(0, 10) ||
    input.slotId !== reservation.slotId;

  // undefined would mean "leave unchanged" on an update — null is required
  // to actually clear a previously-set request.
  const request = input.request?.trim() || null;

  if (slotChanged) {
    const outcome = await withSeatAssignment(
      newDate,
      input.slotId,
      reservation.id,
      (teamSlotIndex) =>
        database.reservation.update({
          where: { id: reservation.id },
          data: {
            date: newDate,
            partySize: input.partySize,
            request,
            slotId: input.slotId,
            teamSlotIndex,
          },
        })
    );
    if (!outcome.success) {
      return { success: false, error: DUPLICATE_SLOT_ERROR };
    }
    return { success: true };
  }

  await database.reservation.update({
    where: { id: reservation.id },
    data: { partySize: input.partySize, request },
  });
  return { success: true };
}
