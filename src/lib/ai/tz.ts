import { dayWindow } from "@/lib/day-window";
/**
 * Timezone helpers for AI routes.
 *
 * The frontend always sends `tz` (IANA name from Intl.DateTimeFormat) in the
 * request body. Server-side code must NEVER assume UTC+8 or server local time.
 * All day-boundary calculations and time normalization must use the user's tz.
 */

/**
 * Validate an IANA timezone string. Falls back to "UTC" if invalid.
 */
export function safeTimezone(tz: unknown): string {
  if (typeof tz !== "string" || !tz) return "UTC";
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

/**
 * Return "YYYY-MM-DD" for a Date in the given IANA timezone.
 */
export function localDateStr(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Return the UTC timestamp for 09:00 local time on the same calendar date
 * as `isoStr`, interpreted in the user's timezone.
 *
 * Example: isoStr="2026-06-21T15:59:00Z", tz="America/New_York"
 *   → local date = Jun 21 → 09:00 EDT = 13:00 UTC → "2026-06-21T13:00:00.000Z"
 */
export function normalizeToMorning(isoStr: string | null, tz: string): string | null {
  if (!isoStr) return null;
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;

  // Get the local date string (YYYY-MM-DD) in the user's tz
  const localDate = localDateStr(d, tz); // e.g. "2026-06-21"

  const target = Date.parse(localDate + "T09:00:00Z");
  let result = target;
  for (let i = 0; i < 4; i++) {
    const offset = getUtcOffsetStr(new Date(result), tz);
    const sign = offset[0] === "-" ? -1 : 1;
    const minutes = sign * (Number(offset.slice(1, 3)) * 60 + Number(offset.slice(4, 6)));
    result = target - minutes * 60000;
  }
  return new Date(result).toISOString();
}

/**
 * Return start-of-day (00:00:00) and end-of-day (23:59:59.999) as UTC
 * Date objects for "today" in the user's timezone.
 */
export function localDayBounds(
  now: Date,
  tz: string
): { start: Date; end: Date } {
  const { start, nextStart } = dayWindow(localDateStr(now, tz), tz);
  return { start, end: new Date(+nextStart - 1) };
}

/**
 * Format a Date as "YYYY-MM-DDTHH:mm:ssZ±HH:mm" in the user's timezone,
 * for passing to AI prompts as the current time.
 */
export function localNowStr(date: Date, tz: string): string {
  return date.toLocaleString("sv-SE", { timeZone: tz }).replace(" ", "T") +
    getUtcOffsetStr(date, tz);
}

function getUtcOffsetStr(date: Date, tz: string): string {
  const utcMs = date.getTime();
  // Format the date in the target tz, then parse back to get the offset
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const localMs = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  const offsetMin = Math.round((localMs - utcMs) / 60000);
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${sign}${hh}:${mm}`;
}
