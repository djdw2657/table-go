"use server";

import { database } from "@repo/database";
import {
  isClosedDay,
  parseDateOnly,
  SLOT_CAPACITY,
  todayDateOnly,
} from "./reservation-shared";
import { isValidName, isValidPhone } from "./validation";

export interface JoinWaitlistInput {
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  date: string;
  partySize: number;
  request?: string;
  slotId: string;
}

export type JoinWaitlistResult =
  | { success: true }
  | { success: false; error: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function joinWaitlist(
  input: JoinWaitlistInput
): Promise<JoinWaitlistResult> {
  const date = parseDateOnly(input.date);

  if (await isClosedDay(date)) {
    return { success: false, error: "휴무일입니다. 다른 날짜를 선택해주세요." };
  }
  if (date.getTime() < todayDateOnly().getTime()) {
    return { success: false, error: "지난 날짜는 대기 등록할 수 없습니다." };
  }

  const slot = await database.timeSlot.findUnique({
    where: { id: input.slotId },
  });
  if (!slot) {
    return { success: false, error: "올바르지 않은 시간대입니다." };
  }

  const customerName = input.customerName.trim();
  const customerPhone = input.customerPhone.trim();
  const customerEmail = input.customerEmail.trim();

  if (!(customerName && customerPhone && customerEmail)) {
    return {
      success: false,
      error: "이름, 연락처, 이메일을 모두 입력해주세요.",
    };
  }
  if (!isValidName(customerName)) {
    return {
      success: false,
      error: "이름은 한글 또는 영문으로 2자 이상 입력해주세요.",
    };
  }
  if (!isValidPhone(customerPhone)) {
    return { success: false, error: "올바른 전화번호 형식이 아닙니다." };
  }
  if (!EMAIL_PATTERN.test(customerEmail)) {
    return {
      success: false,
      error: "자리가 나면 이메일로 알려드리니, 올바른 이메일을 입력해주세요.",
    };
  }
  if (
    !Number.isInteger(input.partySize) ||
    input.partySize < 1 ||
    input.partySize > 20
  ) {
    return { success: false, error: "인원 수를 확인해주세요 (1~20명)." };
  }

  const activeCount = await database.reservation.count({
    where: { date, slotId: input.slotId, status: { not: "CANCELLED" } },
  });
  if (activeCount < SLOT_CAPACITY) {
    return {
      success: false,
      error: "해당 시간대는 지금 바로 예약 가능합니다. 예약을 진행해주세요.",
    };
  }

  await database.waitlist.create({
    data: {
      customerEmail,
      customerName,
      customerPhone,
      date,
      partySize: input.partySize,
      request: input.request?.trim() || undefined,
      slotId: input.slotId,
      token: crypto.randomUUID(),
    },
  });

  return { success: true };
}
