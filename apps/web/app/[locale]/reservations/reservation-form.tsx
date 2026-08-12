"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Calendar } from "@repo/design-system/components/ui/calendar";
import { Card, CardContent } from "@repo/design-system/components/ui/card";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { createReservation, getAvailability } from "./actions";

const TIME_SLOTS = [
  { value: "SLOT_10_12", label: "10:00 - 12:00" },
  { value: "SLOT_12_14", label: "12:00 - 14:00" },
  { value: "SLOT_14_16", label: "14:00 - 16:00" },
  { value: "SLOT_16_18", label: "16:00 - 18:00" },
  { value: "SLOT_18_20", label: "18:00 - 20:00" },
  { value: "SLOT_20_22", label: "20:00 - 22:00" },
] as const;

function toDateStr(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isWeekend(date: Date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function startOfToday() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

export function ReservationForm() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [isLoadingAvailability, startAvailabilityTransition] = useTransition();
  const [isSubmitting, startSubmitTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [partySize, setPartySize] = useState(2);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [request, setRequest] = useState("");

  const handleSelectDate = (date: Date | undefined) => {
    setSelectedDate(date);
    setSelectedSlot(null);
    setError(null);
    if (!date) {
      return;
    }
    startAvailabilityTransition(async () => {
      const result = await getAvailability(toDateStr(date));
      setBookedSlots(result.bookedSlots);
    });
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!(selectedDate && selectedSlot)) {
      setError("날짜와 시간을 선택해주세요.");
      return;
    }

    const dateStr = toDateStr(selectedDate);

    startSubmitTransition(async () => {
      const result = await createReservation({
        date: dateStr,
        timeSlot: selectedSlot,
        partySize,
        customerName,
        customerPhone,
        request,
      });

      if (!result.success) {
        setError(result.error);
        const refreshed = await getAvailability(dateStr);
        setBookedSlots(refreshed.bookedSlots);
        return;
      }

      router.push(`/reservations/${result.reservationId}`);
    });
  };

  return (
    <div className="container mx-auto grid max-w-4xl gap-8 pb-24 lg:grid-cols-2">
      <Card className="h-fit">
        <CardContent className="flex justify-center pt-6">
          <Calendar
            disabled={(date) => isWeekend(date) || date < startOfToday()}
            mode="single"
            onSelect={handleSelectDate}
            selected={selectedDate}
          />
        </CardContent>
      </Card>

      <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
        <div>
          <Label className="mb-3 block">시간 선택</Label>
          {!selectedDate && (
            <p className="text-muted-foreground text-sm">
              먼저 날짜를 선택해주세요. (토, 일 휴무)
            </p>
          )}
          {selectedDate && (
            <div className="grid grid-cols-3 gap-2">
              {TIME_SLOTS.map((slot) => {
                const isBooked = bookedSlots.includes(slot.value);
                return (
                  <Button
                    disabled={isBooked || isLoadingAvailability}
                    key={slot.value}
                    onClick={() => setSelectedSlot(slot.value)}
                    type="button"
                    variant={selectedSlot === slot.value ? "default" : "outline"}
                  >
                    {isBooked ? "마감" : slot.label}
                  </Button>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="partySize">인원</Label>
          <Input
            id="partySize"
            max={20}
            min={1}
            onChange={(event) => setPartySize(Number(event.target.value))}
            required
            type="number"
            value={partySize}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="customerName">예약자 이름</Label>
          <Input
            id="customerName"
            onChange={(event) => setCustomerName(event.target.value)}
            required
            value={customerName}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="customerPhone">연락처</Label>
          <Input
            id="customerPhone"
            onChange={(event) => setCustomerPhone(event.target.value)}
            placeholder="010-1234-5678"
            required
            value={customerPhone}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="request">요청사항 (선택)</Label>
          <Input
            id="request"
            onChange={(event) => setRequest(event.target.value)}
            value={request}
          />
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <Button disabled={isSubmitting} size="lg" type="submit">
          {isSubmitting ? "예약 중..." : "예약하기"}
        </Button>
      </form>
    </div>
  );
}
