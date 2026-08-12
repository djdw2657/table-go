import { database } from "@repo/database";
import { Button } from "@repo/design-system/components/ui/button";
import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "./components/header";

const title = "테이블GO 관리자";
const description = "예약 현황을 확인하세요.";

export const metadata: Metadata = {
  title,
  description,
};

function todayDateOnly() {
  return new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
}

const App = async () => {
  const today = todayDateOnly();
  const [todayCount, upcomingCount] = await Promise.all([
    database.reservation.count({ where: { date: today } }),
    database.reservation.count({ where: { date: { gte: today } } }),
  ]);

  return (
    <>
      <Header page="대시보드" pages={["테이블GO"]} />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
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
      </div>
    </>
  );
};

export default App;
