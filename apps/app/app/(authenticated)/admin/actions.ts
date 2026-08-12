"use server";

import { database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { env } from "@/env";

export async function cancelReservation(id: string) {
  await database.reservation.update({
    where: { id },
    // Clearing activeSlotKey frees the (date, slotId) unique key back up so
    // the slot can be rebooked (see schema.prisma for why this field exists).
    data: { status: "CANCELLED", activeSlotKey: null },
  });
  revalidatePath("/admin");
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

  const holidays = (data.items ?? [])
    .filter((item): item is GoogleCalendarEvent & { start: { date: string } } =>
      Boolean(item.start?.date)
    )
    .map((item) => ({
      date: new Date(`${item.start.date}T00:00:00.000Z`),
      reason: item.summary ?? null,
    }));

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
