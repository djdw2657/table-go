import { database } from "@repo/database";
import type { Metadata } from "next";
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
    where: { date: { gte: today } },
    orderBy: [{ date: "asc" }, { timeSlot: "asc" }],
  });

  return (
    <>
      <Header page="예약 관리" pages={["테이블GO"]} />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <ReservationsTable reservations={reservations} />
      </div>
    </>
  );
};

export default AdminPage;
