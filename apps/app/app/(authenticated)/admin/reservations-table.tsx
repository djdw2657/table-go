import type { Reservation } from "@repo/database";
import { Button } from "@repo/design-system/components/ui/button";
import { cancelReservation } from "./actions";

const SLOT_LABELS: Record<string, string> = {
  SLOT_10_12: "10:00 - 12:00",
  SLOT_12_14: "12:00 - 14:00",
  SLOT_14_16: "14:00 - 16:00",
  SLOT_16_18: "16:00 - 18:00",
  SLOT_18_20: "18:00 - 20:00",
  SLOT_20_22: "20:00 - 22:00",
};

interface ReservationsTableProps {
  reservations: Reservation[];
}

function groupByDate(reservations: Reservation[]) {
  const grouped = new Map<string, Reservation[]>();
  for (const reservation of reservations) {
    const dateKey = reservation.date.toISOString().slice(0, 10);
    const list = grouped.get(dateKey) ?? [];
    list.push(reservation);
    grouped.set(dateKey, list);
  }
  return grouped;
}

export const ReservationsTable = ({ reservations }: ReservationsTableProps) => {
  if (reservations.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        예정된 예약이 없습니다.
      </p>
    );
  }

  const grouped = groupByDate(reservations);

  return (
    <div className="flex flex-col gap-6">
      {Array.from(grouped.entries()).map(([dateKey, dayReservations]) => (
        <div key={dateKey}>
          <h2 className="mb-2 font-semibold text-lg">{dateKey}</h2>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-3 text-left font-medium">시간</th>
                  <th className="p-3 text-left font-medium">예약자</th>
                  <th className="p-3 text-left font-medium">연락처</th>
                  <th className="p-3 text-left font-medium">인원</th>
                  <th className="p-3 text-left font-medium">요청사항</th>
                  <th className="p-3 text-right font-medium">관리</th>
                </tr>
              </thead>
              <tbody>
                {dayReservations.map((reservation) => (
                  <tr className="border-t" key={reservation.id}>
                    <td className="p-3">{SLOT_LABELS[reservation.timeSlot]}</td>
                    <td className="p-3">{reservation.customerName}</td>
                    <td className="p-3">{reservation.customerPhone}</td>
                    <td className="p-3">{reservation.partySize}명</td>
                    <td className="p-3 text-muted-foreground">
                      {reservation.request ?? "-"}
                    </td>
                    <td className="p-3 text-right">
                      <form action={cancelReservation.bind(null, reservation.id)}>
                        <Button size="sm" type="submit" variant="destructive">
                          취소
                        </Button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
};
