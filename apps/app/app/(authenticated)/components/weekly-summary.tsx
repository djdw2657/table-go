import { database } from "@repo/database";
import { cn } from "@repo/design-system/lib/utils";

const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];
const ORANGE_THRESHOLD = 3;
const RED_THRESHOLD = 5;

// `date` columns store UTC-midnight standing in for a KST calendar date, so
// "today" must be today's KST date — not the UTC date, which is still
// "yesterday" for the first 9 hours of each KST day.
function todayDateOnly() {
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return new Date(`${kstNow.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

// Monday-start week containing `date`.
function startOfWeek(date: Date) {
  const day = date.getUTCDay(); // 0=Sun..6=Sat
  const daysSinceMonday = (day + 6) % 7;
  return addDays(date, -daysSinceMonday);
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function WeeklySummary() {
  const today = todayDateOnly();
  const tomorrow = addDays(today, 1);
  const monday = startOfWeek(today);
  const weekEndExclusive = addDays(monday, 7);

  const [reservations, holidays] = await Promise.all([
    database.reservation.findMany({
      where: {
        date: { gte: monday, lt: weekEndExclusive },
        status: { not: "CANCELLED" },
      },
      select: { date: true },
    }),
    database.holiday.findMany({
      where: { date: { gte: monday, lt: weekEndExclusive } },
      select: { date: true },
    }),
  ]);

  const countByDate = new Map<string, number>();
  for (const reservation of reservations) {
    const key = toDateKey(reservation.date);
    countByDate.set(key, (countByDate.get(key) ?? 0) + 1);
  }
  const holidaySet = new Set(holidays.map((h) => toDateKey(h.date)));

  const todayKey = toDateKey(today);
  const tomorrowKey = toDateKey(tomorrow);

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(monday, index);
    const key = toDateKey(date);
    const dayOfWeek = date.getUTCDay();
    const isClosed = dayOfWeek === 0 || dayOfWeek === 6 || holidaySet.has(key);
    return {
      count: countByDate.get(key) ?? 0,
      dateLabel: `${date.getUTCMonth() + 1}/${date.getUTCDate()}`,
      isClosed,
      isToday: key === todayKey,
      isTomorrow: key === tomorrowKey,
      key,
      label: DAY_LABELS[index],
    };
  });

  const totalCount = days.reduce((sum, day) => sum + day.count, 0);

  return (
    <div className="rounded-xl border p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <p className="font-medium text-sm">이번 주 예약 요약</p>
        <p className="text-muted-foreground text-sm">총 {totalCount}건</p>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => (
          <div
            className={cn(
              "flex flex-col items-center gap-1 rounded-lg border p-3",
              day.isClosed && "bg-muted text-muted-foreground",
              !day.isClosed &&
                day.count >= RED_THRESHOLD &&
                "border-red-500/50 bg-red-500/10",
              !day.isClosed &&
                day.count >= ORANGE_THRESHOLD &&
                day.count < RED_THRESHOLD &&
                "border-orange-500/50 bg-orange-500/10",
              day.isToday && "ring-2 ring-primary",
              day.isTomorrow && "ring-1 ring-primary/40"
            )}
            key={day.key}
          >
            <span className="text-xs">{day.label}</span>
            <span className="text-[10px] text-muted-foreground">
              {day.dateLabel}
            </span>
            <span className="font-semibold text-lg">
              {day.isClosed ? "휴무" : `${day.count}건`}
            </span>
            {day.isToday && (
              <span className="text-[10px] text-primary">오늘</span>
            )}
            {day.isTomorrow && (
              <span className="text-[10px] text-primary/70">내일</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
