"use server";

import { database } from "@repo/database";

// `date` columns store UTC-midnight standing in for a KST calendar date, so
// "today" must be today's KST date — not the UTC date, which is still
// "yesterday" for the first 9 hours of each KST day.
function todayDateOnly() {
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return new Date(`${kstNow.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

export interface TrendPoint {
  count: number;
  label: string;
}

// Buckets non-cancelled reservations by their (KST) reservation date into
// the last 8 weeks (Mon-start) or last 6 calendar months, oldest first.
export async function getReservationTrend(
  period: "month" | "week"
): Promise<TrendPoint[]> {
  const today = todayDateOnly();
  const bucketCount = period === "week" ? 8 : 6;
  const buckets: { end: Date; label: string; start: Date }[] = [];

  if (period === "week") {
    const dayOfWeek = today.getUTCDay();
    const daysSinceMonday = (dayOfWeek + 6) % 7;
    const currentWeekStart = new Date(today);
    currentWeekStart.setUTCDate(today.getUTCDate() - daysSinceMonday);

    for (let i = bucketCount - 1; i >= 0; i--) {
      const start = new Date(currentWeekStart);
      start.setUTCDate(currentWeekStart.getUTCDate() - i * 7);
      const end = new Date(start);
      end.setUTCDate(start.getUTCDate() + 7);
      buckets.push({
        end,
        label: `${start.getUTCMonth() + 1}/${start.getUTCDate()}`,
        start,
      });
    }
  } else {
    const currentMonthStart = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)
    );
    for (let i = bucketCount - 1; i >= 0; i--) {
      const start = new Date(
        Date.UTC(
          currentMonthStart.getUTCFullYear(),
          currentMonthStart.getUTCMonth() - i,
          1
        )
      );
      const end = new Date(
        Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)
      );
      buckets.push({ end, label: `${start.getUTCMonth() + 1}월`, start });
    }
  }

  const firstBucket = buckets[0];
  const lastBucket = buckets.at(-1);
  if (!(firstBucket && lastBucket)) {
    return [];
  }

  const reservations = await database.reservation.findMany({
    where: {
      date: { gte: firstBucket.start, lt: lastBucket.end },
      status: { not: "CANCELLED" },
    },
    select: { date: true },
  });

  return buckets.map((bucket) => ({
    count: reservations.filter(
      (r) => r.date >= bucket.start && r.date < bucket.end
    ).length,
    label: bucket.label,
  }));
}

export interface PopularSlot {
  count: number;
  displayName: string;
}

export async function getPopularTimeSlots(): Promise<PopularSlot[]> {
  const [reservations, slots] = await Promise.all([
    database.reservation.findMany({
      where: { status: { not: "CANCELLED" } },
      select: { slotId: true },
    }),
    database.timeSlot.findMany({ orderBy: { startTime: "asc" } }),
  ]);

  const countBySlot = new Map<string, number>();
  for (const reservation of reservations) {
    countBySlot.set(
      reservation.slotId,
      (countBySlot.get(reservation.slotId) ?? 0) + 1
    );
  }

  return slots
    .map((slot) => ({
      count: countBySlot.get(slot.id) ?? 0,
      displayName: slot.displayName,
    }))
    .sort((a, b) => b.count - a.count);
}

export interface CancellationStats {
  thisMonthRate: number;
  totalCancelled: number;
  totalRate: number;
  totalReservations: number;
}

export async function getCancellationStats(): Promise<CancellationStats> {
  const today = todayDateOnly();
  const monthStart = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)
  );

  const [totalReservations, totalCancelled, monthTotal, monthCancelled] =
    await Promise.all([
      database.reservation.count(),
      database.reservation.count({ where: { status: "CANCELLED" } }),
      database.reservation.count({ where: { date: { gte: monthStart } } }),
      database.reservation.count({
        where: { date: { gte: monthStart }, status: "CANCELLED" },
      }),
    ]);

  return {
    thisMonthRate:
      monthTotal > 0
        ? Math.round((monthCancelled / monthTotal) * 1000) / 10
        : 0,
    totalCancelled,
    totalRate:
      totalReservations > 0
        ? Math.round((totalCancelled / totalReservations) * 1000) / 10
        : 0,
    totalReservations,
  };
}

export interface RegularCustomer {
  customerName: string;
  customerPhone: string;
  lastVisit: string;
  visitCount: number;
}

// Groups by phone number (the only stable customer identifier — there are
// no accounts) and only surfaces customers with 2+ non-cancelled visits.
export async function getRegularCustomers(): Promise<RegularCustomer[]> {
  const reservations = await database.reservation.findMany({
    orderBy: { date: "desc" },
    select: { customerName: true, customerPhone: true, date: true },
    where: { status: { not: "CANCELLED" } },
  });

  const byPhone = new Map<
    string,
    { customerName: string; lastVisit: Date; visitCount: number }
  >();
  for (const reservation of reservations) {
    const existing = byPhone.get(reservation.customerPhone);
    if (existing) {
      existing.visitCount += 1;
    } else {
      // `reservations` is sorted newest-first, so the first time we see a
      // phone number, its customerName is already the most recent one.
      byPhone.set(reservation.customerPhone, {
        customerName: reservation.customerName,
        lastVisit: reservation.date,
        visitCount: 1,
      });
    }
  }

  return [...byPhone.entries()]
    .filter(([, info]) => info.visitCount >= 2)
    .map(([customerPhone, info]) => ({
      customerName: info.customerName,
      customerPhone,
      lastVisit: info.lastVisit.toISOString().slice(0, 10),
      visitCount: info.visitCount,
    }))
    .sort((a, b) => b.visitCount - a.visitCount)
    .slice(0, 20);
}
