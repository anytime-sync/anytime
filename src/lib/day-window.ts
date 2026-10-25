/** Half-open local calendar days, including DST and fractional UTC offsets. */
export function calendarDate(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = (key: string) => parts.find(p => p.type === key)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

export function validTimezone(timeZone: string): string {
  try { new Intl.DateTimeFormat('en', { timeZone }); return timeZone; }
  catch { return 'UTC'; }
}

export function taskDate(value: string, timeZone: string): string {
  return validDate(value) ? value : calendarDate(new Date(value), validTimezone(timeZone));
}

export function addCalendarDays(date: string, days: number): string {
  return new Date(Date.parse(date) + days * 86400000).toISOString().slice(0, 10);
}

/** Encode local wall-clock components in a UTC-shaped Date for rrule. The
 * returned value is a civil time, not an instant. */
export function wallClock(date: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: validTimezone(timeZone), year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const get = (key: string) => Number(parts.find(p => p.type === key)!.value);
  return new Date(Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'), date.getUTCMilliseconds()));
}

/** Resolve a civil time independently of the host timezone. In a fall-back
 * overlap choose the first occurrence; nonexistent spring-forward times fail. */
export function instantFromWallClock(civil: Date, timeZone: string): Date | null {
  const zone = validTimezone(timeZone);
  const date = civil.toISOString().slice(0, 10);
  let guess = +dayWindow(date, zone).start + (+civil - Date.parse(date));
  for (let i = 0; i < 4; i++) {
    const delta = +civil - +wallClock(new Date(guess), zone);
    if (delta === 0) return new Date(guess);
    guess += delta;
  }
  return null;
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
