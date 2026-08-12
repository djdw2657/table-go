import { database } from "@repo/database";
import { Button } from "@repo/design-system/components/ui/button";
import { Card, CardContent } from "@repo/design-system/components/ui/card";
import Link from "next/link";
import { notFound } from "next/navigation";

interface ReservationConfirmationPageProps {
  params: Promise<{ id: string; locale: string }>;
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between border-b pb-2 text-sm last:border-b-0 last:pb-0">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium">{value}</span>
  </div>
);

const ReservationConfirmationPage = async ({
  params,
}: ReservationConfirmationPageProps) => {
  const { id } = await params;
  const reservation = await database.reservation.findUnique({
    where: { id },
    include: { timeSlot: true },
  });

  if (!reservation) {
    notFound();
  }

  const dateLabel = reservation.date.toISOString().slice(0, 10);

  return (
    <div className="container mx-auto max-w-md py-24 text-center">
      <h1 className="font-regular text-3xl tracking-tighter">
        예약이 완료되었습니다
      </h1>
      <Card className="mt-8 text-left">
        <CardContent className="space-y-3 pt-6">
          <Row label="예약번호" value={reservation.reservationNumber} />
          <Row label="날짜" value={dateLabel} />
          <Row label="시간" value={reservation.timeSlot.displayName} />
          <Row label="인원" value={`${reservation.partySize}명`} />
          <Row label="예약자" value={reservation.customerName} />
          <Row label="연락처" value={reservation.customerPhone} />
          {reservation.customerEmail && (
            <Row label="이메일" value={reservation.customerEmail} />
          )}
          {reservation.request && (
            <Row label="요청사항" value={reservation.request} />
          )}
        </CardContent>
      </Card>
      <div className="mt-8 flex flex-col items-center gap-3">
        <Button asChild size="lg">
          <Link href="/">홈으로</Link>
        </Button>
        <Link
          className="text-muted-foreground text-sm underline"
          href="/check-reservation"
        >
          예약 확인/취소/변경하기
        </Link>
      </div>
    </div>
  );
};

export default ReservationConfirmationPage;
