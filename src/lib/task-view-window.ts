import { addCalendarDays, dayWindow } from './day-window';

/** Account-local smart-list boundaries. Ends are exclusive, including DST days. */
export function taskViewWindow(view: string | undefined, date: string, timeZone: string) {
  const days = view === 'today' || view === 'tomorrow' ? 1 : view === 'next7' ? 7 : view === 'next90' ? 90 : 0;
  if (!days) return null;
  const first = view === 'tomorrow' ? addCalendarDays(date, 1) : date;
  return {
    from: dayWindow(first, timeZone).start,
    to: dayWindow(addCalendarDays(first, days), timeZone).start,
  };
}
