"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { cn } from "@repo/design-system/lib/utils";
import { useEffect, useRef } from "react";
import { type DayButton, getDefaultClassNames } from "react-day-picker";

// Mirrors the design system's CalendarDayButton (packages/design-system/
// components/ui/calendar.tsx) — the selected/focus/range data-attribute
// styling below is copied from there, since overriding `components.DayButton`
// entirely (to add the "마감" dot) would otherwise silently drop it. Kept in
// apps/web (not the shared design-system package) so the ink-and-seal look
// only applies to the reservation site, not the admin dashboard.
export function FullDayButton({
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
        "relative flex aspect-square size-auto w-full min-w-(--cell-size) flex-col gap-0 rounded-none font-normal leading-none data-[range-end=true]:bg-primary data-[range-middle=true]:bg-accent data-[range-start=true]:bg-primary data-[selected-single=true]:bg-primary data-[range-end=true]:text-primary-foreground data-[range-middle=true]:text-accent-foreground data-[range-start=true]:text-primary-foreground data-[selected-single=true]:text-primary-foreground group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-[3px] group-data-[focused=true]/day:ring-ring/50 dark:hover:text-accent-foreground",
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
        <span className="absolute right-1 bottom-1 size-1.5 bg-brand-red" />
      )}
    </Button>
  );
}
