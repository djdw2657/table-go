import { database } from "@repo/database";
import { Button } from "@repo/design-system/components/ui/button";
import type { Metadata } from "next";
import Link from "next/link";
import { env } from "@/env";
import { Header } from "../components/header";
import { ReservationsTable } from "./reservations-table";

export const metadata: Metadata = {
  title: "예약 관리 | 테이블GO",
};

function todayDateOnly() {
  return new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
}

const AdminPage = async () => {
  const today = todayDateOnly();
  const reservations = await database.reservation.findMany({
    where: { date: { gte: today }, status: { not: "CANCELLED" } },
    include: { timeSlot: true },
    orderBy: [{ date: "asc" }, { timeSlot: { startTime: "asc" } }],
  });

  return (
    <>
      <Header page="예약 관리" pages={["테이블GO"]}>
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
        <ReservationsTable reservations={reservations} />
      </div>
    </>
  );
};

export default AdminPage;
