import type { ParsedQuickInput } from './quick-parse';
import { addCalendarDays } from './day-window';

/** Task span ends are inclusive; Google all-day event ends are exclusive. */
export function captureEventDates(parsed: ParsedQuickInput, fallback: string) {
  const first = parsed.start_date ?? parsed.due_date;
  if (parsed.is_all_day && first) {
    return {
      is_all_day: true,
      start_date: first,
      end_date: addCalendarDays(parsed.due_date ?? first, 1),
    };
  }
  const start = parsed.start_at ?? parsed.due_at ?? fallback;
  return {
    is_all_day: false,
    start_at: start,
    ...(parsed.start_at && parsed.due_at && parsed.start_at !== parsed.due_at
      ? { end_at: parsed.due_at }
      : {}),
  };
}
