"use server";

import { database } from "@repo/database";
import { resend } from "@repo/email";
import { ReservationConfirmationEmail } from "@repo/email/templates/reservation-confirmation";
import { ReservationNotificationEmail } from "@repo/email/templates/reservation-notification";
import { revalidatePath } from "next/cache";
import { env } from "@/env";
import {
  DUPLICATE_SLOT_ERROR,
  isClosedDay,
  parseDateOnly,
  SLOT_CAPACITY,
  todayDateOnly,
  withSeatAssignment,
} from "./reservation-shared";
import { RESTAURANT_INFO } from "./restaurant-info";
import { isValidEmail, isValidName, isValidPhone } from "./validation";

// Best-effort — a customer's booking should still succeed even if Resend is
// unreachable or RESEND_TOKEN isn't configured (e.g. local dev without a
// key). Errors are logged, never thrown back to the caller.
async function sendReservationEmails(input: {
  customerEmail?: string;
  customerName: string;
  customerPhone: string;
  date: string;
  partySize: number;
  request?: string;
  reservationNumber: string;
  timeRange: string;
}) {
  if (!resend) {
    return;
  }

  // The customer still has to enter their phone number on the lookup page
  // to prove ownership — the reservation number in the link only pre-fills
  // that field and jumps straight to the edit/cancel step, it never grants
  // access by itself.
  const numberParam = encodeURIComponent(input.reservationNumber);
  const editUrl = `${env.NEXT_PUBLIC_WEB_URL}/check-reservation?number=${numberParam}&intent=edit`;
  const cancelUrl = `${env.NEXT_PUBLIC_WEB_URL}/check-reservation?number=${numberParam}&intent=cancel`;
  const adminUrl = env.NEXT_PUBLIC_APP_URL;

  const sends: Promise<unknown>[] = [];

  if (input.customerEmail) {
    sends.push(
      resend.emails.send({
        from: env.RESEND_FROM ?? "onboarding@resend.dev",
        react: ReservationConfirmationEmail({
          cancelUrl,
          customerName: input.customerName,
          date: input.date,
          editUrl,
          partySize: input.partySize,
          reservationNumber: input.reservationNumber,
          restaurantAddress: RESTAURANT_INFO.address,
          restaurantName: RESTAURANT_INFO.name,
          restaurantPhone: RESTAURANT_INFO.phone,
          timeRange: input.timeRange,
        }),
        subject: "[테이블GO] 예약 확정",
        to: input.customerEmail,
      })
    );
  }

  if (env.RESTAURANT_NOTIFICATION_EMAIL) {
    sends.push(
      resend.emails.send({
        from: env.RESEND_FROM ?? "onboarding@resend.dev",
        react: ReservationNotificationEmail({
          adminUrl,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          date: input.date,
          partySize: input.partySize,
          request: input.request ?? null,
          reservationNumber: input.reservationNumber,
          restaurantName: RESTAURANT_INFO.name,
          timeRange: input.timeRange,
        }),
        subject: "새 예약 1건",
        to: env.RESTAURANT_NOTIFICATION_EMAIL,
      })
    );
  }

  const results = await Promise.allSettled(sends);
  for (const result of results) {
    if (result.status === "rejected") {
      console.error("Failed to send reservation email:", result.reason);
    }
  }
}

export async function getTimeSlots() {
  return database.timeSlot.findMany({ orderBy: { startTime: "asc" } });
}

export interface SlotAvailability {
  remaining: number;
  slotId: string;
}

export async function getAvailability(
  dateStr: string,
  excludeReservationId?: string
) {
  const date = parseDateOnly(dateStr);

  if (await isClosedDay(date)) {
    return { closed: true, slotAvailability: [] as SlotAvailability[] };
  }

  const [slots, reservations] = await Promise.all([
    database.timeSlot.findMany({ select: { id: true } }),
    database.reservation.findMany({
      where: {
        date,
        status: { not: "CANCELLED" },
        ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
      },
      select: { slotId: true },
    }),
  ]);

  const countBySlot = new Map<string, number>();
  for (const reservation of reservations) {
    countBySlot.set(
      reservation.slotId,
      (countBySlot.get(reservation.slotId) ?? 0) + 1
    );
  }

  const slotAvailability = slots.map((slot) => ({
    remaining: Math.max(0, SLOT_CAPACITY - (countBySlot.get(slot.id) ?? 0)),
    slotId: slot.id,
  }));

  return { closed: false, slotAvailability };
}

// month is "YYYY-MM". Returns, for the visible calendar month, which dates
// have every time slot at full capacity ("마감") and which are holidays, so
// the calendar can mark them without a per-date round trip.
export async function getMonthAvailability(
  month: string,
  excludeReservationId?: string
) {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1));

  const [totalSlots, reservations, holidays] = await Promise.all([
    database.timeSlot.count(),
    database.reservation.findMany({
      where: {
        date: { gte: start, lt: end },
        status: { not: "CANCELLED" },
        ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
      },
      select: { date: true, slotId: true },
    }),
    database.holiday.findMany({
      where: { date: { gte: start, lt: end } },
      select: { date: true },
    }),
  ]);

  const countsByDate = new Map<string, Map<string, number>>();
  for (const reservation of reservations) {
    const key = reservation.date.toISOString().slice(0, 10);
    const bySlot = countsByDate.get(key) ?? new Map<string, number>();
    bySlot.set(reservation.slotId, (bySlot.get(reservation.slotId) ?? 0) + 1);
    countsByDate.set(key, bySlot);
  }

  const fullDates = [...countsByDate.entries()]
    .filter(([, bySlot]) => {
      if (totalSlots === 0 || bySlot.size < totalSlots) {
        return false;
      }
      return [...bySlot.values()].every((count) => count >= SLOT_CAPACITY);
    })
    .map(([dateStr]) => dateStr);

  const holidayDates = holidays.map((h) => h.date.toISOString().slice(0, 10));

  return { fullDates, holidayDates };
}

export interface CreateReservationInput {
  customerEmail?: string;
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

// "R-YYYYMMDD-NNN" — NNN is a per-date sequence. There are at most 6 slots
// a day, so counting existing rows for the date is enough (no separate
// counter table needed); the reservationNumber unique constraint is the
// backstop if two requests ever race on the same count.
async function generateReservationNumber(dateStr: string, date: Date) {
  const countForDate = await database.reservation.count({ where: { date } });
  const sequence = String(countForDate + 1).padStart(3, "0");
  return `R-${dateStr.replaceAll("-", "")}-${sequence}`;
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
  const customerEmail = input.customerEmail?.trim();

  if (!(customerName && customerPhone)) {
    return { success: false, error: "이름과 연락처를 입력해주세요." };
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

  if (customerEmail && !isValidEmail(customerEmail)) {
    return { success: false, error: "올바른 이메일 형식이 아닙니다." };
  }

  if (
    !Number.isInteger(input.partySize) ||
    input.partySize < 1 ||
    input.partySize > 20
  ) {
    return { success: false, error: "인원 수를 확인해주세요 (1~20명)." };
  }

  // Re-checks capacity on the server right before writing — the client may
  // be looking at availability that's a few seconds stale (see the polling
  // in reservation-form.tsx) — and assigns a teamSlotIndex seat, retrying on
  // a concurrent-request race. The `@@unique([date, slotId, teamSlotIndex])`
  // constraint (see schema.prisma) is the actual backstop if two requests
  // still race past this.
  const outcome = await withSeatAssignment(
    date,
    input.slotId,
    undefined,
    async (teamSlotIndex) =>
      database.reservation.create({
        data: {
          date,
          slotId: input.slotId,
          partySize: input.partySize,
          customerName,
          customerPhone,
          customerEmail: customerEmail || undefined,
          request: input.request?.trim() || undefined,
          reservationNumber: await generateReservationNumber(input.date, date),
          teamSlotIndex,
        },
      })
  );

  if (!outcome.success) {
    return { success: false, error: DUPLICATE_SLOT_ERROR };
  }
  revalidatePath("/reservations");

  await sendReservationEmails({
    customerEmail,
    customerName,
    customerPhone,
    date: input.date,
    partySize: input.partySize,
    request: input.request,
    reservationNumber: outcome.result.reservationNumber,
    timeRange: slot.displayName,
  });

  return { success: true, reservationId: outcome.result.id };
}
