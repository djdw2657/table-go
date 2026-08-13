"use server";

import { database } from "@repo/database";
import { createReservation } from "../../reservations/actions";

export interface WaitlistEntryView {
  customerName: string;
  date: string;
  notifyExpiresAt: string | null;
  status: string;
  timeSlot: { displayName: string };
}

export async function getWaitlistEntry(
  token: string
): Promise<WaitlistEntryView | null> {
  const entry = await database.waitlist.findUnique({
    where: { token },
    include: { timeSlot: true },
  });
  if (!entry) {
    return null;
  }
  return {
    customerName: entry.customerName,
    date: entry.date.toISOString().slice(0, 10),
    notifyExpiresAt: entry.notifyExpiresAt?.toISOString() ?? null,
    status: entry.status,
    timeSlot: { displayName: entry.timeSlot.displayName },
  };
}

export type ClaimWaitlistResult =
  | { success: true; reservationId: string }
  | { success: false; error: string };

export async function claimWaitlist(
  token: string
): Promise<ClaimWaitlistResult> {
  const entry = await database.waitlist.findUnique({ where: { token } });
  if (!entry) {
    return { success: false, error: "대기 정보를 찾을 수 없습니다." };
  }
  if (entry.status === "CONFIRMED") {
    return { success: false, error: "이미 예약이 확정된 대기입니다." };
  }
  if (entry.status !== "NOTIFIED") {
    return {
      success: false,
      error: "대기가 만료되었거나 취소되었습니다. 다시 예약을 진행해주세요.",
    };
  }
  if (entry.notifyExpiresAt && entry.notifyExpiresAt.getTime() < Date.now()) {
    return {
      success: false,
      error: "확정 가능 시간이 지났습니다. 다음 대기자에게 안내되었습니다.",
    };
  }

  const result = await createReservation({
    customerEmail: entry.customerEmail,
    customerName: entry.customerName,
    customerPhone: entry.customerPhone,
    date: entry.date.toISOString().slice(0, 10),
    partySize: entry.partySize,
    request: entry.request ?? undefined,
    slotId: entry.slotId,
  });
  if (!result.success) {
    return result;
  }

  await database.waitlist.update({
    where: { id: entry.id },
    data: { status: "CONFIRMED" },
  });

  return { success: true, reservationId: result.reservationId };
}
