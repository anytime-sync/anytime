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

  // Build 09:00 in that tz using a known fixed reference
  // Parse "YYYY-MM-DDT09:00:00" as if it were local time in `tz`
  const [year, month, day] = localDate.split("-").map(Number);

  // Use Intl to find the UTC offset at 09:00 on that date in that tz
  // Trick: format a known UTC time and compare with what Intl says
  // Simpler: iterate to find the UTC instant that equals 09:00 local
  const approxUtc = new Date(Date.UTC(year, month - 1, day, 9, 0, 0));

  // Get what local hour that UTC time maps to in the target tz
  const localHour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      hour12: false,
    }).format(approxUtc)
  );

  // Adjust: if localHour != 9, we need to shift approxUtc
  const diffMs = (localHour - 9) * 60 * 60 * 1000;
  const result = new Date(approxUtc.getTime() - diffMs);
  return result.toISOString();
}

/**
 * Return start-of-day (00:00:00) and end-of-day (23:59:59.999) as UTC
 * Date objects for "today" in the user's timezone.
 */
export function localDayBounds(
  now: Date,
  tz: string
): { start: Date; end: Date } {
  const localDate = localDateStr(now, tz); // "YYYY-MM-DD"
  const [year, month, day] = localDate.split("-").map(Number);

  // 00:00 local
  const approxStart = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const startLocalHour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false }).format(approxStart)
  );
  const startUtc = new Date(approxStart.getTime() - startLocalHour * 60 * 60 * 1000);

  // end = start + 24h - 1ms
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000 - 1);

  return { start: startUtc, end: endUtc };
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
