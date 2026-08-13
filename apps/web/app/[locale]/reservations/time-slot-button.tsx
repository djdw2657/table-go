"use client";

import type { TimeSlot } from "@repo/database";
import { Button } from "@repo/design-system/components/ui/button";
import { cn } from "@repo/design-system/lib/utils";

interface TimeSlotGridProps {
  bookedSlotIds: string[];
  disabled?: boolean;
  onSelect: (slotId: string) => void;
  selectedSlot: string | null;
  timeSlots: TimeSlot[];
}

// Shared by the booking form and the self-service edit panel so the two
// never drift visually — see full-day-button.tsx for the calendar half.
export function TimeSlotGrid({
  bookedSlotIds,
  disabled,
  onSelect,
  selectedSlot,
  timeSlots,
}: TimeSlotGridProps) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {timeSlots.map((slot) => {
        const isBooked = bookedSlotIds.includes(slot.id);
        return (
          <Button
            className={cn(
              "h-11 rounded-none sm:h-9",
              !(isBooked || selectedSlot === slot.id) &&
                "hover:border-b-2 hover:border-b-brand-red",
              isBooked && "text-muted-foreground line-through"
            )}
            disabled={isBooked || disabled}
            key={slot.id}
            onClick={() => onSelect(slot.id)}
            type="button"
            variant={selectedSlot === slot.id ? "default" : "outline"}
          >
            {isBooked ? "마감" : slot.displayName}
          </Button>
        );
      })}
    </div>
  );
}
