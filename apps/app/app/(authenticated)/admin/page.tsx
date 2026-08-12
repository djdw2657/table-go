import { Button } from "@repo/design-system/components/ui/button";
import type { Metadata } from "next";
import Link from "next/link";
import { env } from "@/env";
import { Header } from "../components/header";
import { getFilteredReservations, getHolidays } from "./actions";
import { CalendarSlotPanel } from "./calendar-slot-panel";
import { HolidayManager } from "./holiday-manager";
import { ReservationsTable } from "./reservations-table";

export const metadata: Metadata = {
  title: "예약 관리 | 테이블GO",
};

const AdminPage = async () => {
  const [reservations, holidays] = await Promise.all([
    getFilteredReservations(),
    getHolidays(),
  ]);

  return (
    <>
      <Header page="예약 관리" pages={["테이블GO"]}>
        <div className="mr-4 flex items-center gap-2">
          <HolidayManager initialHolidays={holidays} />
          <Button asChild size="sm" variant="outline">
            <Link
              href={env.NEXT_PUBLIC_WEB_URL}
              rel="noopener noreferrer"
              target="_blank"
            >
              예약 사이트 보기
            </Link>
          </Button>
        </div>
      </Header>
      <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
        <CalendarSlotPanel />
        <ReservationsTable initialReservations={reservations} />
      </div>
    </>
  );
};

export default AdminPage;
