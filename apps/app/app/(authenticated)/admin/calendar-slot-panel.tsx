"use client";

import { Calendar } from "@repo/design-system/components/ui/calendar";
import { Card, CardContent } from "@repo/design-system/components/ui/card";
import { cn } from "@repo/design-system/lib/utils";
import { useEffect, useState } from "react";
import { getSlotStatusForDate, type SlotStatus } from "./actions";

function toDateStr(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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
                  "rounded-md border px-2 py-3 text-center text-sm transition-colors",
                  slot.booked
                    ? "border-blue-500/50 bg-blue-500/15 text-blue-600 dark:text-blue-400"
                    : "border-muted bg-muted/50 text-muted-foreground",
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
                {slot.displayName}
              </button>
            ))}
          </div>

          {selectedSlot && (
            <div className="rounded-md border p-3 text-sm">
              {selectedSlot.reservation ? (
                <div className="flex flex-col gap-1">
                  <p className="font-medium">
                    {selectedSlot.reservation.reservationNumber}
                  </p>
                  <p>
                    {selectedSlot.reservation.customerName} ·{" "}
                    {selectedSlot.reservation.customerPhone} ·{" "}
                    {selectedSlot.reservation.partySize}명
                  </p>
                  {selectedSlot.reservation.request && (
                    <p className="text-muted-foreground">
                      요청사항: {selectedSlot.reservation.request}
                    </p>
                  )}
                </div>
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
