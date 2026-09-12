/** Half-open local calendar days, including DST and fractional UTC offsets. */
export function calendarDate(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = (key: string) => parts.find(p => p.type === key)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

export function dayWindow(date: string, timeZone: string) {
  if (!validDate(date)) throw new Error('Invalid calendar date');
  const midnight = Date.parse(date);
  const boundary = (target: string, center: number) => {
    let lo = center - 36 * 3600000, hi = center + 36 * 3600000;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (calendarDate(new Date(mid), timeZone) < target) lo = mid + 1;
      else hi = mid;
    }
    return new Date(lo);
  };
  const tomorrow = new Date(midnight + 86400000).toISOString().slice(0, 10);
  return { start: boundary(date, midnight), nextStart: boundary(tomorrow, midnight + 86400000) };
}

export function dailyTaskFilter(start: string, nextStart: string) {
  return `due_at.lt.${nextStart},and(start_at.gte.${start},start_at.lt.${nextStart})`;
}
