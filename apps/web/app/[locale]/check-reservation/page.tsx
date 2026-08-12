import type { Metadata } from "next";
import { getTimeSlots } from "../reservations/actions";
import { CheckReservationForm } from "./check-reservation-form";

export const metadata: Metadata = {
  title: "예약 확인 | 테이블GO",
};

const CheckReservationPage = async () => {
  const timeSlots = await getTimeSlots();

  return (
    <div className="container mx-auto max-w-md py-16">
      <h1 className="mb-8 text-center font-regular text-3xl tracking-tighter">
        예약 확인
      </h1>
      <CheckReservationForm timeSlots={timeSlots} />
    </div>
  );
};

export default CheckReservationPage;
