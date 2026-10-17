import type { SupabaseClient } from "@supabase/supabase-js";
import { dayWindow } from "@/lib/day-window";

/** calendar_events uses timestamptz even for Google's date-only values. */
export type DigestCalendarEvent = {
  id: string;
  title: string | null;
  start_at: string | null;
  end_at: string | null;
  is_all_day: boolean;
  cancelled: boolean;
  status: string | null;
  task_id: string | null;
  /** Projected from raw.attendees; JSON may be absent or malformed. */
  attendees?: unknown;
};

export type DigestAgendaItem = {
  id: string;
  title: string | null;
  /** Civil dates for all-day entries, instants for timed entries. */
  start: string;
  end: string | null;
  isAllDay: boolean;
};

const PAGE_SIZE = 200;

/** Read stored occurrences, not recurrence masters or newly expanded rules. */
export async function loadDigestAgenda(
  supabase: SupabaseClient,
  userId: string,
  localDate: string,
  timezone: string,
  displayedTaskIds: ReadonlySet<string>,
): Promise<DigestAgendaItem[]> {
  const { start, nextStart } = dayWindow(localDate, timezone);
  const dateStart = `${localDate}T00:00:00.000Z`;
  const dateEnd = nextDate(localDate) + "T00:00:00.000Z";
  const overlap = (allDay: boolean, from: string, to: string) =>
    `and(is_all_day.eq.${allDay},start_at.lt.${to},or(end_at.gt.${from},start_at.gte.${from}))`;
  const events: DigestCalendarEvent[] = [];

  // Separate civil-date bounds from recipient-local timed bounds. Include
  // starts within the day too, so a missing end or a zero-duration event is
  // still represented. Endpoints are checked again when building the agenda.
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("calendar_events")
      .select("id,title,start_at,end_at,is_all_day,cancelled,status,task_id,attendees:raw->attendees")
      .eq("user_id", userId)
      .eq("cancelled", false)
      .or("status.is.null,status.neq.cancelled")
      .or(`${overlap(false, start.toISOString(), nextStart.toISOString())},${overlap(true, dateStart, dateEnd)}`)
      .order("start_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as DigestCalendarEvent[];
    events.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return buildDigestAgenda(events, localDate, timezone, displayedTaskIds);
}

export function buildDigestAgenda(
  events: DigestCalendarEvent[],
  localDate: string,
  timezone: string,
  displayedTaskIds: ReadonlySet<string>,
): DigestAgendaItem[] {
  const { start: dayStart, nextStart: dayEnd } = dayWindow(localDate, timezone);
  const agenda: DigestAgendaItem[] = [];
  for (const event of events) {
    if (event.cancelled || event.status === "cancelled") continue;
    // Event status can stay confirmed after the calendar owner declines.
    // `self` identifies this calendar's attendee even when the connected
    // Google address differs from the app recipient. Other guests may decline
    // without changing the owner's agenda. Never render attendee metadata.
    if (Array.isArray(event.attendees) && event.attendees.some(attendee =>
      attendee && typeof attendee === "object" && attendee.self === true && attendee.responseStatus === "declined"
    )) continue;
    if (event.task_id && displayedTaskIds.has(event.task_id)) continue;
    const start = parseInstant(event.start_at);
    const end = parseInstant(event.end_at);
    if (!start || (event.end_at !== null && !end)) continue;

    if (event.is_all_day) {
      // Sync stores Google {date} as midnight UTC; never shift those dates
      // through the recipient's timezone. Google end dates are exclusive.
      const startDate = start.toISOString().slice(0, 10);
      const endDate = end?.toISOString().slice(0, 10) ?? nextDate(startDate);
      if (endDate <= startDate || startDate > localDate || endDate <= localDate) continue;
      agenda.push({ id: event.id, title: event.title, start: startDate, end: endDate, isAllDay: true });
    } else {
      if (end && +end < +start) continue;
      const overlaps = end && +end > +start
        ? start < dayEnd && end > dayStart
        : start >= dayStart && start < dayEnd;
      if (!overlaps) continue;
      agenda.push({ id: event.id, title: event.title, start: start.toISOString(), end: end?.toISOString() ?? null, isAllDay: false });
    }
  }

  // All-day entries precede appointments. Keep distinct recurring instances
  // (even with the same title) and break simultaneous-start ties by row id.
  return agenda.sort((a, b) => Number(b.isAllDay) - Number(a.isAllDay)
    || a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
}

function parseInstant(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(+date) ? date : null;
}

function nextDate(date: string): string {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}
