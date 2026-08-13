"use client";

import type { TimeSlot } from "@repo/database";
import { Button } from "@repo/design-system/components/ui/button";
import { cn } from "@repo/design-system/lib/utils";
import type { SlotAvailability } from "./actions";

interface TimeSlotGridProps {
  disabled?: boolean;
  onJoinWaitlist?: (slotId: string) => void;
  onSelect: (slotId: string) => void;
  selectedSlot: string | null;
  slotAvailability: SlotAvailability[];
  timeSlots: TimeSlot[];
}

// Shared by the booking form and the self-service edit panel so the two
// never drift visually — see full-day-button.tsx for the calendar half.
// `onJoinWaitlist` is only passed by the booking form (not the self-service
// edit panel, where "대기 등록" doesn't make sense) — see reservation-form.tsx.
export function TimeSlotGrid({
  disabled,
  onJoinWaitlist,
  onSelect,
  selectedSlot,
  slotAvailability,
  timeSlots,
}: TimeSlotGridProps) {
  const remainingBySlot = new Map(
    slotAvailability.map((slot) => [slot.slotId, slot.remaining])
  );

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {timeSlots.map((slot) => {
        // A slot the caller hasn't reported on yet (e.g. availability still
        // loading) is treated as full rather than bookable, so it can't be
        // clicked before the real count arrives.
        const remaining = remainingBySlot.get(slot.id) ?? 0;
        const isFull = remaining <= 0;
        return (
          <div className="flex flex-col gap-1" key={slot.id}>
            <Button
              className={cn(
                "h-12 w-full flex-col gap-0.5 rounded-none sm:h-11",
                !(isFull || selectedSlot === slot.id) &&
                  "hover:border-b-2 hover:border-b-brand-red",
                isFull && "text-muted-foreground line-through"
              )}
              disabled={isFull || disabled}
              onClick={() => onSelect(slot.id)}
              type="button"
              variant={selectedSlot === slot.id ? "default" : "outline"}
            >
              <span>{isFull ? "마감" : slot.displayName}</span>
              {!isFull && (
                <span className="font-normal text-[10px] opacity-70">
                  {remaining}팀 가능
                </span>
              )}
            </Button>
            {isFull && onJoinWaitlist && (
              <button
                className="text-[11px] text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-brand-red"
                onClick={() => onJoinWaitlist(slot.id)}
                type="button"
              >
                대기 등록
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
