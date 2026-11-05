import { addCalendarDays, calendarDate, dayWindow } from './day-window';

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

/** Civil intent takes precedence; legacy/timed rows retain instant comparison. */
export function taskViewFilter(view: string | undefined, win: { from: Date; to: Date }, zone: string) {
  const first = calendarDate(win.from, zone), next = calendarDate(win.to, zone);
  const from = win.from.toISOString(), to = win.to.toISOString();
  const date = (field: string) => view === 'tomorrow' ? `${field}.gte.${first},${field}.lt.${next}` : `${field}.lt.${next}`;
  const instant = (field: string) => view === 'tomorrow' ? `${field}.gte.${from},${field}.lt.${to}` : `${field}.lt.${to}`;
  return `and(${date('due_date')}),and(due_date.is.null,${instant('due_at')}),and(due_date.is.null,due_at.is.null,${date('start_date')}),and(due_date.is.null,due_at.is.null,start_date.is.null,${instant('start_at')})`;
}
