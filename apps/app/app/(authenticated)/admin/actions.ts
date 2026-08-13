"use server";

import { database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { env } from "@/env";

// `date` columns store UTC-midnight standing in for a KST calendar date, so
// "today" must be today's KST date — not the UTC date, which is still
// "yesterday" for the first 9 hours of each KST day.
function todayDateOnly() {
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return new Date(`${kstNow.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

// Must match SLOT_CAPACITY in apps/web/app/[locale]/reservations/reservation-shared.ts
// (the two apps don't share a package for this — same constant, kept in sync
// by hand since it's a single fixed number, not per-slot configurable).
const SLOT_CAPACITY = 3;

export interface SlotStatus {
  displayName: string;
  id: string;
  remaining: number;
  reservations: {
    customerName: string;
    customerPhone: string;
    id: string;
    partySize: number;
    request: string | null;
    reservationNumber: string;
    status: string;
  }[];
  startTime: string;
}

export async function getSlotStatusForDate(
  dateStr: string
): Promise<SlotStatus[]> {
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  const [slots, reservations] = await Promise.all([
    database.timeSlot.findMany({ orderBy: { startTime: "asc" } }),
    database.reservation.findMany({
      where: { date, status: { not: "CANCELLED" } },
    }),
  ]);

  const reservationsBySlot = new Map<string, typeof reservations>();
  for (const reservation of reservations) {
    const existing = reservationsBySlot.get(reservation.slotId) ?? [];
    existing.push(reservation);
    reservationsBySlot.set(reservation.slotId, existing);
  }

  return slots.map((slot) => {
    const slotReservations = reservationsBySlot.get(slot.id) ?? [];
    return {
      displayName: slot.displayName,
      id: slot.id,
      remaining: Math.max(0, SLOT_CAPACITY - slotReservations.length),
      reservations: slotReservations.map((reservation) => ({
        customerName: reservation.customerName,
        customerPhone: reservation.customerPhone,
        id: reservation.id,
        partySize: reservation.partySize,
        request: reservation.request,
        reservationNumber: reservation.reservationNumber,
        status: reservation.status,
      })),
      startTime: slot.startTime,
    };
  });
}

export interface ReservationFilters {
  endDate?: string;
  sortOrder?: "asc" | "desc";
  startDate?: string;
  status?: "ALL" | "PENDING" | "CONFIRMED" | "CANCELLED";
}

export async function getFilteredReservations(
  filters: ReservationFilters = {}
) {
  const startDate = filters.startDate
    ? new Date(`${filters.startDate}T00:00:00.000Z`)
    : todayDateOnly();
  const endDate = filters.endDate
    ? new Date(`${filters.endDate}T00:00:00.000Z`)
    : null;

  return database.reservation.findMany({
    where: {
      date: endDate ? { gte: startDate, lte: endDate } : { gte: startDate },
      ...(filters.status && filters.status !== "ALL"
        ? { status: filters.status }
        : {}),
    },
    include: { timeSlot: true },
    orderBy: [
      { date: filters.sortOrder ?? "asc" },
      { timeSlot: { startTime: "asc" } },
    ],
  });
}

export type UpdateReservationStatusResult =
  | { success: true }
  | { success: false; error: string };

export async function updateReservationStatus(input: {
  cancelReason?: string;
  id: string;
  status: "CONFIRMED" | "CANCELLED";
}): Promise<UpdateReservationStatusResult> {
  const existing = await database.reservation.findUnique({
    where: { id: input.id },
  });
  if (!existing) {
    return { success: false, error: "예약을 찾을 수 없습니다." };
  }

  await database.reservation.update({
    where: { id: input.id },
    data:
      input.status === "CANCELLED"
        ? {
            status: "CANCELLED",
            cancelReason: input.cancelReason?.trim() || null,
            // Frees the seat back up (see schema.prisma for why this exists).
            teamSlotIndex: null,
          }
        : { status: "CONFIRMED" },
  });
  revalidatePath("/admin");
  return { success: true };
}

// Google's public "Holidays in South Korea" calendar — readable with just an
// API key, no OAuth needed since it's a public calendar.
const KR_HOLIDAY_CALENDAR_ID =
  "ko.south_korea#holiday@group.v.calendar.google.com";

interface GoogleCalendarEvent {
  start?: { date?: string };
  summary?: string;
}

interface GoogleCalendarEventsResponse {
  error?: { message?: string };
  items?: GoogleCalendarEvent[];
}

export type ImportHolidaysResult =
  | { success: true; imported: number; skipped: number }
  | { success: false; error: string };

export async function importHolidays(
  year: number
): Promise<ImportHolidaysResult> {
  if (!env.GOOGLE_CALENDAR_API_KEY) {
    return {
      success: false,
      error: "GOOGLE_CALENDAR_API_KEY가 설정되어 있지 않습니다.",
    };
  }

  const params = new URLSearchParams({
    key: env.GOOGLE_CALENDAR_API_KEY,
    timeMin: `${year}-01-01T00:00:00Z`,
    timeMax: `${year + 1}-01-01T00:00:00Z`,
    singleEvents: "true",
    orderBy: "startTime",
  });

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(KR_HOLIDAY_CALENDAR_ID)}/events?${params}`
  );

  const data = (await response.json()) as GoogleCalendarEventsResponse;

  if (!response.ok) {
    return {
      success: false,
      error:
        data.error?.message ??
        `공휴일 조회에 실패했습니다. (${response.status})`,
    };
  }

  const today = todayDateOnly();
  const holidays = (data.items ?? [])
    .filter((item): item is GoogleCalendarEvent & { start: { date: string } } =>
      Boolean(item.start?.date)
    )
    .map((item) => ({
      date: new Date(`${item.start.date}T00:00:00.000Z`),
      reason: item.summary ?? null,
    }))
    .filter((holiday) => holiday.date.getTime() >= today.getTime());

  let imported = 0;
  let skipped = 0;

  for (const holiday of holidays) {
    const existing = await database.holiday.findUnique({
      where: { date: holiday.date },
    });
    if (existing) {
      skipped += 1;
      continue;
    }
    await database.holiday.create({
      data: { date: holiday.date, reason: holiday.reason },
    });
    imported += 1;
  }

  revalidatePath("/admin");

  return { success: true, imported, skipped };
}

export async function getHolidays() {
  return database.holiday.findMany({ orderBy: { date: "asc" } });
}

export async function deleteHolidays(ids: string[]) {
  await database.holiday.deleteMany({ where: { id: { in: ids } } });
  revalidatePath("/admin");
}
