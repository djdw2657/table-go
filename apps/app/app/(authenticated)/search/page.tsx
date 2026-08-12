import { auth } from "@repo/auth/server";
import { database } from "@repo/database";
import { notFound, redirect } from "next/navigation";
import { Header } from "../components/header";

const SLOT_LABELS: Record<string, string> = {
  SLOT_10_12: "10:00 - 12:00",
  SLOT_12_14: "12:00 - 14:00",
  SLOT_14_16: "14:00 - 16:00",
  SLOT_16_18: "16:00 - 18:00",
  SLOT_18_20: "18:00 - 20:00",
  SLOT_20_22: "20:00 - 22:00",
};

interface SearchPageProperties {
  searchParams: Promise<{
    q: string;
  }>;
}

export const generateMetadata = async ({
  searchParams,
}: SearchPageProperties) => {
  const { q } = await searchParams;

  return {
    title: `${q} - 예약 검색 결과`,
    description: `"${q}" 예약자 검색 결과`,
  };
};

const SearchPage = async ({ searchParams }: SearchPageProperties) => {
  const { q } = await searchParams;
  const { orgId } = await auth();

  if (!orgId) {
    notFound();
  }

  if (!q) {
    redirect("/");
  }

  const reservations = await database.reservation.findMany({
    where: {
      customerName: {
        contains: q,
      },
    },
    orderBy: [{ date: "asc" }, { timeSlot: "asc" }],
  });

  return (
    <>
      <Header page="예약 검색" pages={["테이블GO"]} />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        {reservations.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            "{q}"에 대한 예약을 찾을 수 없습니다.
          </p>
        ) : (
          <div className="grid auto-rows-min gap-4 md:grid-cols-3">
            {reservations.map((reservation) => (
              <div
                className="rounded-xl border bg-muted/50 p-4 text-sm"
                key={reservation.id}
              >
                <p className="font-medium">{reservation.customerName}</p>
                <p className="text-muted-foreground">
                  {reservation.date.toISOString().slice(0, 10)} ·{" "}
                  {SLOT_LABELS[reservation.timeSlot]}
                </p>
                <p className="text-muted-foreground">
                  {reservation.partySize}명 · {reservation.customerPhone}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default SearchPage;
