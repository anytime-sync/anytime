import {
  addCalendarDays,
  dayWindow,
  taskDate,
  validDate,
  validTimezone,
} from './day-window';
import type {
  GoogleCalendarEvent,
  GoogleCalendarEventInput,
} from './google-calendar';

/** Google DATE end is exclusive. Timestamp input is legacy compatibility and
 * is interpreted in the account zone, never the server's timezone. */
export function googleEventDates(
  input: {
    start_at?: string;
    end_at?: string;
    start_date?: string;
    end_date?: string;
    is_all_day?: boolean;
  },
  timezone: string,
): Pick<GoogleCalendarEventInput, 'start' | 'end'> {
  const zone = validTimezone(timezone);
  if (input.is_all_day) {
    const start =
      input.start_date ??
      (input.start_at ? taskDate(input.start_at, zone) : '');
    const end =
      input.end_date ??
      (input.end_at ? taskDate(input.end_at, zone) : addCalendarDays(start, 1));
    if (!validDate(start) || !validDate(end) || end <= start)
      throw new Error(
        'All-day end date must be after the start date (exclusive).',
      );
    return { start: { date: start }, end: { date: end } };
  }
  // An offset is required; a naïve date-time must be resolved by the editor.
  const absolute = (value?: string) =>
    !!value &&
    /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) &&
    Number.isFinite(Date.parse(value));
  if (!absolute(input.start_at) || (input.end_at && !absolute(input.end_at)))
    throw new Error('Timed events require timestamps with a UTC offset.');
  const start = new Date(input.start_at!).toISOString();
  const end = input.end_at
    ? new Date(input.end_at).toISOString()
    : new Date(Date.parse(start) + 3600000).toISOString();
  if (end <= start) throw new Error('Event end must be after its start.');
  return {
    start: { dateTime: start, timeZone: zone },
    end: { dateTime: end, timeZone: zone },
  };
}

/** One serializer for immediate POST/PATCH mirrors and inbound reload. Raw DATE
 * values remain canonical; compatibility timestamps are half-open account days. */
export function toCalendarEventRow({
  userId,
  calendarId,
  ev,
  timezone = 'UTC',
}: {
  userId: string;
  calendarId: string;
  ev: GoogleCalendarEvent;
  timezone?: string;
}) {
  const zone = validTimezone(ev.start?.timeZone ?? timezone);
  const startAt =
    ev.start?.dateTime ??
    (ev.start?.date
      ? dayWindow(ev.start.date, zone).start.toISOString()
      : null);
  const endAt =
    ev.end?.dateTime ??
    (ev.end?.date ? dayWindow(ev.end.date, zone).start.toISOString() : null);
  return {
    user_id: userId,
    provider: 'google' as const,
    external_id: ev.id,
    calendar_id: calendarId,
    title: ev.summary ?? null,
    description: ev.description ?? null,
    location: ev.location ?? null,
    start_at: startAt,
    end_at: endAt,
    is_all_day: !!ev.start?.date,
    status: ev.status ?? 'confirmed',
    html_link: ev.htmlLink ?? null,
    organizer_email: ev.organizer?.email ?? null,
    attendees_count: ev.attendees?.length ?? 0,
    raw: ev as unknown as Record<string, unknown>,
    fetched_at: new Date().toISOString(),
    cancelled: ev.status === 'cancelled',
  };
}
