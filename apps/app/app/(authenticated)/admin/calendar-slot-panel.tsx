"use client";

import { Calendar } from "@repo/design-system/components/ui/calendar";
import { Card, CardContent } from "@repo/design-system/components/ui/card";
import { cn } from "@repo/design-system/lib/utils";
import { useReservationChangeSignal } from "@repo/realtime";
import { useEffect, useState } from "react";
import { getSlotStatusForDate, type SlotStatus } from "./actions";

function toDateStr(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function slotToneClassName(slot: SlotStatus) {
  if (slot.remaining <= 0) {
    return "border-blue-500/50 bg-blue-500/15 text-blue-600 dark:text-blue-400";
  }
  if (slot.reservations.length > 0) {
    return "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400";
  }
  return "border-muted bg-muted/50 text-muted-foreground";
}

export function CalendarSlotPanel() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    () => new Date()
  );
  const [slots, setSlots] = useState<SlotStatus[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedDate) {
      setSlots([]);
      return;
    }
    let cancelled = false;
    setSelectedSlotId(null);
    getSlotStatusForDate(toDateStr(selectedDate)).then((result) => {
      if (!cancelled) {
        setSlots(result);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  // Instant push — re-fetch the currently viewed date's slot status on any
  // reservation/waitlist change, without disturbing the selected slot.
  useReservationChangeSignal(() => {
    if (!selectedDate) {
      return;
    }
    getSlotStatusForDate(toDateStr(selectedDate)).then(setSlots);
  });

  const selectedSlot = slots.find((slot) => slot.id === selectedSlotId);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="h-fit">
        <CardContent className="flex justify-center pt-6">
          <Calendar
            mode="single"
            onSelect={setSelectedDate}
            selected={selectedDate}
          />
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardContent className="flex flex-col gap-4 pt-6">
          <p className="font-medium text-sm">
            {selectedDate ? toDateStr(selectedDate) : "날짜를 선택하세요"}{" "}
            시간대 현황
          </p>
          <div className="grid grid-cols-3 gap-2">
            {slots.map((slot) => (
              <button
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-md border px-2 py-3 text-center text-sm transition-colors",
                  slotToneClassName(slot),
                  selectedSlotId === slot.id && "ring-2 ring-primary"
                )}
                key={slot.id}
                onClick={() =>
                  setSelectedSlotId((current) =>
                    current === slot.id ? null : slot.id
                  )
                }
                type="button"
              >
                <span>{slot.displayName}</span>
                <span className="text-xs opacity-80">
                  {slot.reservations.length}/3팀
                </span>
                {slot.waitlistCount > 0 && (
                  <span className="text-[10px] opacity-70">
                    대기 {slot.waitlistCount}팀
                  </span>
                )}
              </button>
            ))}
          </div>

          {selectedSlot && (
            <div className="flex flex-col gap-2 rounded-md border p-3 text-sm">
              {selectedSlot.reservations.length > 0 ? (
                selectedSlot.reservations.map((reservation, index) => (
                  <div
                    className={cn(
                      "flex flex-col gap-1",
                      index > 0 && "border-t pt-2"
                    )}
                    key={reservation.id}
                  >
                    <p className="font-medium">
                      {reservation.reservationNumber}
                    </p>
                    <p>
                      {reservation.customerName} · {reservation.customerPhone} ·{" "}
                      {reservation.partySize}명
                    </p>
                    {reservation.request && (
                      <p className="text-muted-foreground">
                        요청사항: {reservation.request}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">
                  이 시간대는 예약이 없습니다.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
