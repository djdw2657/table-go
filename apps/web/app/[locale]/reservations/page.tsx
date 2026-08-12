import type { Metadata } from "next";
import { getTimeSlots } from "./actions";
import { ReservationForm } from "./reservation-form";

export const metadata: Metadata = {
  title: "예약하기 | 테이블GO",
  description: "날짜와 시간을 선택하고 테이블GO 예약을 완료해주세요.",
};

const ReservationsPage = async () => {
  const timeSlots = await getTimeSlots();

  return (
    <div>
      <div className="container mx-auto pt-16 pb-12 text-center">
        <h1 className="font-regular text-4xl tracking-tighter md:text-5xl">
          예약하기
        </h1>
        <p className="mt-4 text-muted-foreground">
          영업시간 10:00 - 22:00 · 2시간 단위 예약 · 토, 일 휴무
        </p>
      </div>
      <ReservationForm timeSlots={timeSlots} />
    </div>
  );
};

export default ReservationsPage;
