import type { Metadata } from "next";
import { getTimeSlots } from "../reservations/actions";
import { CheckReservationForm } from "./check-reservation-form";

export const metadata: Metadata = {
  title: "예약 확인 | 테이블GO",
};

interface CheckReservationPageProps {
  searchParams: Promise<{ intent?: string; number?: string }>;
}

const CheckReservationPage = async ({
  searchParams,
}: CheckReservationPageProps) => {
  const [timeSlots, params] = await Promise.all([getTimeSlots(), searchParams]);
  const initialIntent =
    params.intent === "edit" || params.intent === "cancel"
      ? params.intent
      : undefined;

  return (
    <div className="container mx-auto max-w-md py-16">
      <h1 className="mb-8 text-center font-regular text-3xl tracking-tighter">
        예약 확인
      </h1>
      <CheckReservationForm
        initialIntent={initialIntent}
        initialReservationNumber={params.number}
        timeSlots={timeSlots}
      />
    </div>
  );
};

export default CheckReservationPage;
