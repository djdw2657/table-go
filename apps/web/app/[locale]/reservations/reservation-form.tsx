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
import { type DayButton, getDefaultClassNames } from "react-day-picker";
import {
  createReservation,
  getAvailability,
  getMonthAvailability,
} from "./actions";
import { RESTAURANT_INFO } from "./restaurant-info";
import {
  EMAIL_ERROR,
  formatPhoneNumber,
  isValidEmail,
  isValidName,
  isValidPhone,
  NAME_ERROR,
  PHONE_ERROR,
} from "./validation";

interface ReservationFormProps {
  timeSlots: TimeSlot[];
}

const QUICK_REQUESTS = [
  "창가석",
  "조용한자리",
  "알레르기 있음",
  "유아 동반",
  "기념일",
];

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

// Mirrors the design system's CalendarDayButton (packages/design-system/
// components/ui/calendar.tsx) — the selected/focus/range data-attribute
// styling below is copied from there, since overriding `components.DayButton`
// entirely (to add the "마감" badge) would otherwise silently drop it.
function FullDayButton({
  className,
  day,
  modifiers,
  children,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const defaultClassNames = getDefaultClassNames();
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (modifiers.focused) {
      ref.current?.focus();
    }
  }, [modifiers.focused]);

  return (
    <Button
      className={cn(
        "flex aspect-square size-auto w-full min-w-(--cell-size) flex-col gap-0 font-normal leading-none data-[range-end=true]:rounded-md data-[range-middle=true]:rounded-none data-[range-start=true]:rounded-md data-[range-end=true]:rounded-r-md data-[range-start=true]:rounded-l-md data-[range-end=true]:bg-primary data-[range-middle=true]:bg-accent data-[range-start=true]:bg-primary data-[selected-single=true]:bg-primary data-[range-end=true]:text-primary-foreground data-[range-middle=true]:text-accent-foreground data-[range-start=true]:text-primary-foreground data-[selected-single=true]:text-primary-foreground group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-[3px] group-data-[focused=true]/day:ring-ring/50 dark:hover:text-accent-foreground",
        defaultClassNames.day,
        className
      )}
      data-day={day.date.toLocaleDateString()}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      data-range-start={modifiers.range_start}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      ref={ref}
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
  const [step, setStep] = useState<"form" | "review">("form");
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
  const [customerEmail, setCustomerEmail] = useState("");
  const [request, setRequest] = useState("");

  const [nameTouched, setNameTouched] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);

  const nameError =
    nameTouched && !isValidName(customerName) ? NAME_ERROR : null;
  const phoneError =
    phoneTouched && !isValidPhone(customerPhone) ? PHONE_ERROR : null;
  const emailError =
    emailTouched && !isValidEmail(customerEmail) ? EMAIL_ERROR : null;

  const toggleQuickRequest = (tag: string) => {
    setRequest((previous) => {
      const parts = previous
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
      const index = parts.indexOf(tag);
      if (index === -1) {
        return [...parts, tag].join(", ");
      }
      parts.splice(index, 1);
      return parts.join(", ");
    });
  };

  const isRequestTagActive = (tag: string) =>
    request
      .split(",")
      .map((part) => part.trim())
      .includes(tag);

  const selectedSlotRef = useRef(selectedSlot);
  useEffect(() => {
    selectedSlotRef.current = selectedSlot;
  }, [selectedSlot]);

  const handleSelectDate = (date: Date | undefined) => {
    setSelectedDate(date);
    setSelectedSlot(null);
    setError(null);
    setStep("form");
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
          setStep("form");
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

  // "예약하기" only moves to the review step — nothing is written yet.
  const handleReview = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setNameTouched(true);
    setPhoneTouched(true);
    setEmailTouched(true);

    if (!(selectedDate && selectedSlot)) {
      setError("날짜와 시간을 선택해주세요.");
      return;
    }

    if (
      !(
        isValidName(customerName) &&
        isValidPhone(customerPhone) &&
        isValidEmail(customerEmail)
      )
    ) {
      setError("입력 내용을 다시 확인해주세요.");
      return;
    }

    setStep("review");
  };

  const handleEdit = () => {
    setStep("form");
  };

  const handleConfirm = () => {
    if (!(selectedDate && selectedSlot)) {
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
        customerEmail: customerEmail || undefined,
        request,
      });

      if (!result.success) {
        setError(result.error);
        setStep("form");
        const refreshed = await getAvailability(dateStr);
        setBookedSlotIds(refreshed.bookedSlotIds);
        return;
      }

      router.push(`/reservations/${result.reservationId}`);
    });
  };

  const selectedTimeSlot = timeSlots.find((slot) => slot.id === selectedSlot);

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

      {step === "review" && selectedDate && selectedTimeSlot ? (
        <Card className="h-fit">
          <CardContent className="flex flex-col gap-6 pt-6">
            <h2 className="font-medium text-lg">예약 내용을 확인해주세요</h2>

            <div className="flex flex-col gap-3">
              <ReviewRow label="날짜" value={toDateStr(selectedDate)} />
              <ReviewRow label="시간" value={selectedTimeSlot.displayName} />
              <ReviewRow label="인원" value={`${partySize}명`} />
              <ReviewRow label="예약자" value={customerName} />
              <ReviewRow label="연락처" value={customerPhone} />
              {customerEmail && (
                <ReviewRow label="이메일" value={customerEmail} />
              )}
              {request && <ReviewRow label="요청사항" value={request} />}
            </div>

            <div className="flex flex-col gap-3 border-t pt-4">
              <p className="font-medium text-sm">{RESTAURANT_INFO.name}</p>
              <ReviewRow label="주소" value={RESTAURANT_INFO.address} />
              <ReviewRow label="연락처" value={RESTAURANT_INFO.phone} />
            </div>

            {error && <p className="text-destructive text-sm">{error}</p>}

            <div className="flex gap-2">
              <Button
                className="flex-1"
                disabled={isSubmitting}
                onClick={handleEdit}
                type="button"
                variant="outline"
              >
                수정
              </Button>
              <Button
                className="flex-1"
                disabled={isSubmitting}
                onClick={handleConfirm}
                type="button"
              >
                {isSubmitting ? "예약 중..." : "확인"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <form className="flex flex-col gap-6" onSubmit={handleReview}>
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
              aria-invalid={Boolean(nameError)}
              id="customerName"
              onBlur={() => setNameTouched(true)}
              onChange={(event) => setCustomerName(event.target.value)}
              required
              value={customerName}
            />
            {nameError && (
              <p className="text-destructive text-sm">{nameError}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="customerPhone">연락처</Label>
            <Input
              aria-invalid={Boolean(phoneError)}
              id="customerPhone"
              inputMode="numeric"
              onBlur={() => setPhoneTouched(true)}
              onChange={(event) =>
                setCustomerPhone(formatPhoneNumber(event.target.value))
              }
              placeholder="010-1234-5678"
              required
              value={customerPhone}
            />
            {phoneError && (
              <p className="text-destructive text-sm">{phoneError}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="customerEmail">이메일 (선택)</Label>
            <Input
              aria-invalid={Boolean(emailError)}
              id="customerEmail"
              onBlur={() => setEmailTouched(true)}
              onChange={(event) => setCustomerEmail(event.target.value)}
              placeholder="name@example.com"
              type="email"
              value={customerEmail}
            />
            {emailError && (
              <p className="text-destructive text-sm">{emailError}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="request">요청사항 (선택)</Label>
            <div className="flex flex-wrap gap-2">
              {QUICK_REQUESTS.map((tag) => (
                <Button
                  key={tag}
                  onClick={() => toggleQuickRequest(tag)}
                  size="sm"
                  type="button"
                  variant={isRequestTagActive(tag) ? "default" : "outline"}
                >
                  {tag}
                </Button>
              ))}
            </div>
            <Input
              id="request"
              onChange={(event) => setRequest(event.target.value)}
              value={request}
            />
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <Button size="lg" type="submit">
            예약하기
          </Button>
        </form>
      )}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
