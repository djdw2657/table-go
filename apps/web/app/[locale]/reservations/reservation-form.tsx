"use client";

import type { TimeSlot } from "@repo/database";
import { Button } from "@repo/design-system/components/ui/button";
import { Calendar } from "@repo/design-system/components/ui/calendar";
import { Card, CardContent } from "@repo/design-system/components/ui/card";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { cn } from "@repo/design-system/lib/utils";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import type { DayButton } from "react-day-picker";
import {
  createReservation,
  getAvailability,
  getMonthAvailability,
} from "./actions";

interface ReservationFormProps {
  timeSlots: TimeSlot[];
}

// How often to re-check the selected date's availability and the visible
// month's "마감" (fully booked) status. Short enough to feel live, long
// enough to stay cheap since we only ever query the selected date / month.
const POLL_INTERVAL_MS = 3000;

function toDateStr(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toMonthStr(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
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

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function FullDayButton({
  className,
  day,
  modifiers,
  children,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  return (
    <Button
      className={cn(
        "relative flex aspect-square size-auto w-full min-w-(--cell-size) flex-col gap-0 font-normal leading-none",
        className
      )}
      size="icon"
      variant="ghost"
      {...props}
    >
      {children}
      {modifiers.full && (
        <span className="text-[9px] text-destructive leading-none">마감</span>
      )}
    </Button>
  );
}

export function ReservationForm({ timeSlots }: ReservationFormProps) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [bookedSlotIds, setBookedSlotIds] = useState<string[]>([]);
  const [isLoadingAvailability, startAvailabilityTransition] = useTransition();
  const [isSubmitting, startSubmitTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [displayedMonth, setDisplayedMonth] = useState(() =>
    startOfMonth(new Date())
  );
  const [fullDates, setFullDates] = useState<Set<string>>(new Set());
  const [holidayDates, setHolidayDates] = useState<Set<string>>(new Set());

  const [partySize, setPartySize] = useState(2);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [request, setRequest] = useState("");

  const selectedSlotRef = useRef(selectedSlot);
  useEffect(() => {
    selectedSlotRef.current = selectedSlot;
  }, [selectedSlot]);

  const handleSelectDate = (date: Date | undefined) => {
    setSelectedDate(date);
    setSelectedSlot(null);
    setError(null);
    if (!date) {
      return;
    }
    startAvailabilityTransition(async () => {
      const result = await getAvailability(toDateStr(date));
      setBookedSlotIds(result.bookedSlotIds);
    });
  };

  // Subscribe (via short-interval polling) to the currently selected date's
  // reservations only, so we never pay the cost of watching every date.
  useEffect(() => {
    if (!selectedDate) {
      return;
    }
    const dateStr = toDateStr(selectedDate);
    let cancelled = false;

    const poll = async () => {
      const result = await getAvailability(dateStr);
      if (cancelled) {
        return;
      }
      setBookedSlotIds((previous) => {
        const wasBooked = new Set(previous);
        const isNowBooked = new Set(result.bookedSlotIds);
        const currentSlot = selectedSlotRef.current;

        if (
          currentSlot &&
          !wasBooked.has(currentSlot) &&
          isNowBooked.has(currentSlot)
        ) {
          // Someone else (INSERT) just took the slot we had selected.
          setSelectedSlot(null);
          setError(
            "방금 다른 팀이 이 시간대를 예약했습니다. 다른 시간을 선택해주세요."
          );
        }

        return result.bookedSlotIds;
      });
    };

    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [selectedDate]);

  // Refresh which dates in the visible month are fully booked ("마감") or
  // holidays, both on month navigation and on the same short interval.
  useEffect(() => {
    const monthStr = toMonthStr(displayedMonth);
    let cancelled = false;

    const poll = async () => {
      const result = await getMonthAvailability(monthStr);
      if (cancelled) {
        return;
      }
      setFullDates(new Set(result.fullDates));
      setHolidayDates(new Set(result.holidayDates));
    };

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [displayedMonth]);

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
        slotId: selectedSlot,
        partySize,
        customerName,
        customerPhone,
        request,
      });

      if (!result.success) {
        setError(result.error);
        const refreshed = await getAvailability(dateStr);
        setBookedSlotIds(refreshed.bookedSlotIds);
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
            components={{ DayButton: FullDayButton }}
            disabled={(date) =>
              isWeekend(date) ||
              date < startOfToday() ||
              holidayDates.has(toDateStr(date)) ||
              fullDates.has(toDateStr(date))
            }
            mode="single"
            modifiers={{ full: (date) => fullDates.has(toDateStr(date)) }}
            month={displayedMonth}
            onMonthChange={setDisplayedMonth}
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
              {timeSlots.map((slot) => {
                const isBooked = bookedSlotIds.includes(slot.id);
                return (
                  <Button
                    disabled={isBooked || isLoadingAvailability}
                    key={slot.id}
                    onClick={() => setSelectedSlot(slot.id)}
                    type="button"
                    variant={selectedSlot === slot.id ? "default" : "outline"}
                  >
                    {isBooked ? "마감" : slot.displayName}
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
