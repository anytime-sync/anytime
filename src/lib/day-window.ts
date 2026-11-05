/** Half-open local calendar days, including DST and fractional UTC offsets. */
export function calendarDate(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (key: string) => parts.find((p) => p.type === key)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function validDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}

export function validTimezone(timeZone: string): string {
  try {
    new Intl.DateTimeFormat('en', { timeZone });
    return timeZone;
  } catch {
    return 'UTC';
  }
}

export function taskDate(value: string, timeZone: string): string {
  return validDate(value)
    ? value
    : calendarDate(new Date(value), validTimezone(timeZone));
}

export function addCalendarDays(date: string, days: number): string {
  return new Date(Date.parse(date) + days * 86400000)
    .toISOString()
    .slice(0, 10);
}

/** Encode local wall-clock components in a UTC-shaped Date for rrule. The
 * returned value is a civil time, not an instant. */
export function wallClock(date: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: validTimezone(timeZone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (key: string) => Number(parts.find((p) => p.type === key)!.value);
  return new Date(
    Date.UTC(
      get('year'),
      get('month') - 1,
      get('day'),
      get('hour'),
      get('minute'),
      get('second'),
      date.getUTCMilliseconds(),
    ),
  );
}

/** Resolve wall time using offsets on both sides of a transition. Recurrence
 * chooses the earlier fold and skips gaps (RFC 5545). New user input rejects
 * either ambiguity: it must specify an offset or choose another local time. */
export function wallClockCandidates(civil: Date, timeZone: string): Date[] {
  const zone = validTimezone(timeZone);
  const offsets = new Set<number>();
  for (let hours = -36; hours <= 36; hours += 6) {
    const sample = new Date(+civil + hours * 3600000);
    offsets.add(+wallClock(sample, zone) - +sample);
  }
  return [...offsets]
    .map((offset) => new Date(+civil - offset))
    .filter((date) => +wallClock(date, zone) === +civil)
    .sort((a, b) => +a - +b);
}

export function instantFromWallClock(
  civil: Date,
  timeZone: string,
): Date | null {
  return wallClockCandidates(civil, timeZone)[0] ?? null;
}

export function resolveLocalInput(value: string, timeZone: string): string {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(value) ||
    !validDate(value.slice(0, 10))
  )
    throw new Error('Invalid local date and time');
  const civil = new Date(value + 'Z');
  if (
    !Number.isFinite(+civil) ||
    civil.toISOString().slice(0, 16) !== value.slice(0, 16)
  )
    throw new Error('Invalid local date and time');
  const candidates = wallClockCandidates(civil, timeZone);
  if (candidates.length !== 1)
    throw new Error(
      candidates.length
        ? 'Ambiguous local time: specify a UTC offset or choose another time.'
        : 'This local time does not exist: choose another time.',
    );
  return candidates[0].toISOString();
}

export function localInputValue(instant: string, timeZone: string): string {
  return wallClock(new Date(instant), timeZone).toISOString().slice(0, 16);
}

export function dayWindow(date: string, timeZone: string) {
  if (!validDate(date)) throw new Error('Invalid calendar date');
  const midnight = Date.parse(date);
  const boundary = (target: string, center: number) => {
    let lo = center - 36 * 3600000,
      hi = center + 36 * 3600000;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (calendarDate(new Date(mid), timeZone) < target) lo = mid + 1;
      else hi = mid;
    }
    return new Date(lo);
  };
  const tomorrow = new Date(midnight + 86400000).toISOString().slice(0, 10);
  return {
    start: boundary(date, midnight),
    nextStart: boundary(tomorrow, midnight + 86400000),
  };
}

export function dailyTaskFilter(start: string, nextStart: string) {
  return `due_at.lt.${nextStart},and(start_at.gte.${start},start_at.lt.${nextStart})`;
}
