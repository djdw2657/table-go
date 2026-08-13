import { database } from "@repo/database";

// Marks CONFIRMED reservations whose slot has already started as COMPLETED
// (never CANCELLED, so this only touches reservations nobody cancelled) —
// this is what makes a reservation eligible for a satisfaction-survey email
// 24h later. See packages/database/prisma/schema.prisma for why COMPLETED
// isn't set at booking time.
const KST_OFFSET_HOURS = 9;

function todayDateOnly() {
  const kstNow = new Date(Date.now() + KST_OFFSET_HOURS * 60 * 60 * 1000);
  return new Date(`${kstNow.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

function getSlotStartDateTime(date: Date, startTime: string) {
  const [hourStr, minuteStr] = startTime.split(":");
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  const utcHour = hour - KST_OFFSET_HOURS;
  return new Date(date.getTime() + (utcHour * 60 + minute) * 60_000);
}

export const GET = async () => {
  // Bounds the scan to today-or-earlier confirmed reservations — anything
  // completed drops out of this set for good, so it never grows unbounded.
  const candidates = await database.reservation.findMany({
    include: { timeSlot: true },
    where: { date: { lte: todayDateOnly() }, status: "CONFIRMED" },
  });

  const now = new Date();
  const toComplete = candidates.filter(
    (reservation) =>
      getSlotStartDateTime(reservation.date, reservation.timeSlot.startTime) <
      now
  );

  if (toComplete.length > 0) {
    await database.reservation.updateMany({
      data: { completedAt: now, status: "COMPLETED" },
      where: { id: { in: toComplete.map((reservation) => reservation.id) } },
    });
  }

  return new Response(`OK (${toComplete.length} completed)`, { status: 200 });
};
