import { database } from "@repo/database";
import { Button } from "@repo/design-system/components/ui/button";
import type { Metadata } from "next";
import Link from "next/link";
import { env } from "@/env";
import { Header } from "./components/header";
import { Statistics } from "./components/statistics";
import { WeeklySummary } from "./components/weekly-summary";

const title = "테이블GO 관리자";
const description = "예약 현황을 확인하세요.";

export const metadata: Metadata = {
  title,
  description,
};

// `date` columns store UTC-midnight standing in for a KST calendar date, so
// "today" must be today's KST date — not the UTC date, which is still
// "yesterday" for the first 9 hours of each KST day.
function todayDateOnly() {
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return new Date(`${kstNow.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

const App = async () => {
  const today = todayDateOnly();
  const [todayCount, upcomingCount] = await Promise.all([
    database.reservation.count({
      where: { date: today, status: { not: "CANCELLED" } },
    }),
    database.reservation.count({
      where: { date: { gte: today }, status: { not: "CANCELLED" } },
    }),
  ]);

  return (
    <>
      <Header page="대시보드" pages={["테이블GO"]}>
        <Button asChild className="mr-4" size="sm" variant="outline">
          <Link
            href={env.NEXT_PUBLIC_WEB_URL}
            rel="noopener noreferrer"
            target="_blank"
          >
            예약 사이트 보기
          </Link>
        </Button>
      </Header>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <WeeklySummary />
        <div className="grid auto-rows-min gap-4 md:grid-cols-2">
          <div className="rounded-xl border p-6">
            <p className="text-muted-foreground text-sm">오늘 예약</p>
            <p className="mt-2 font-semibold text-3xl">{todayCount}건</p>
          </div>
          <div className="rounded-xl border p-6">
            <p className="text-muted-foreground text-sm">예정된 전체 예약</p>
            <p className="mt-2 font-semibold text-3xl">{upcomingCount}건</p>
          </div>
        </div>
        <Button asChild className="w-fit">
          <Link href="/admin">예약 관리로 이동</Link>
        </Button>
        <Statistics />
      </div>
    </>
  );
};

export default App;
