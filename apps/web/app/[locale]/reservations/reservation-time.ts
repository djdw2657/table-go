// The reservation `date` column is UTC midnight standing in for a KST
// calendar date (see actions.ts), and TimeSlot.startTime ("HH:mm") is a
// KST wall-clock time. Combine them into the actual UTC instant the slot
// starts, so cancel/edit cutoffs compare against a real point in time.
const KST_OFFSET_HOURS = 9;
export const EDIT_CUTOFF_HOURS = 24;

export function getSlotStartDateTime(date: Date, startTime: string): Date {
  const [hourStr, minuteStr] = startTime.split(":");
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  const utcHour = hour - KST_OFFSET_HOURS;
  return new Date(date.getTime() + (utcHour * 60 + minute) * 60_000);
}

// True until EDIT_CUTOFF_HOURS before the reservation's slot starts.
export function isWithinEditWindow(date: Date, startTime: string): boolean {
  const slotStart = getSlotStartDateTime(date, startTime);
  const cutoff = new Date(
    slotStart.getTime() - EDIT_CUTOFF_HOURS * 60 * 60_000
  );
  return new Date() < cutoff;
}
