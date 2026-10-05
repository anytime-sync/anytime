import { RRule } from 'rrule';
import { calendarDate, validDate, dayWindow } from './day-window';
import { taskTimeKind, timestamp, type TaskDates } from './task-schedule';

export function validTimezone(timezone: string): string {
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }); return timezone; }
  catch { return 'UTC'; }
}

/** Date-only values are civil dates, never UTC instants to be shifted. */
export function taskCalendarDate(value: string, timezone: string): string {
  if (validDate(value)) return value;
  return calendarDate(new Date(value), validTimezone(timezone));
}

export function normalizeTaskDate(value: string | null | undefined, timezone: string) {
  return value && validDate(value) ? dayWindow(value, validTimezone(timezone)).start.toISOString() : value;
}

function nextDate(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function calendarRecurrence(input: string | null | undefined, allDay: boolean, timezone: string): string | null {
  let rule = input?.trim().replace(/^RRULE:/i, '') ?? '';
  if (!rule || /[\r\n]/.test(rule)) return null;
  try { RRule.fromString(rule); } catch { return null; }
  if (allDay) rule = rule.split(';').filter(part => !/^(BYHOUR|BYMINUTE|BYSECOND)=/i.test(part)).map(part => {
    const until = /^UNTIL=(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/i.exec(part);
    if (!until) return part;
    const [, y, m, d, h, min, sec] = until;
    return `UNTIL=${taskCalendarDate(`${y}-${m}-${d}T${h}:${min}:${sec}Z`, timezone).replace(/-/g, '')}`;
  }).join(';');
  return rule;
}

export type TaskCalendarProjection = {
  start: { date: string } | { dateTime: string };
  end: { date: string } | { dateTime: string };
  allDay: boolean;
  transparency: 'transparent' | 'opaque';
  recurrence: string | null;
  deadline: string | null;
};

/** Shared ICS/Google projection. Task span ends are inclusive; calendar DATE
 * ends are exclusive. Effort estimates never create occupied calendar time. */
export function projectTaskCalendar(task: TaskDates & { is_completed?: boolean; status?: string | null; parent_id?: string | null; rrule?: string | null }, timezone = 'UTC'): TaskCalendarProjection | null {
  if (task.parent_id || task.is_completed || task.status === 'done' || task.status === 'archived') return null;
  const kind = taskTimeKind(task);
  const start = timestamp(task.start_at), due = timestamp(task.due_at);
  const anchor = Number.isFinite(due) ? task.due_at! : Number.isFinite(start) ? task.start_at! : null;
  if (!anchor) return null;
  if (kind === 'work') {
    if (!Number.isFinite(start) || !Number.isFinite(due) || due <= start) return null;
    return { start: { dateTime: new Date(start).toISOString() }, end: { dateTime: new Date(due).toISOString() }, allDay: false, transparency: 'opaque', recurrence: calendarRecurrence(task.rrule, false, timezone), deadline: null };
  }
  const first = kind === 'span' && Number.isFinite(start) ? task.start_at! : anchor;
  const firstDate = taskCalendarDate(first, timezone), lastDate = taskCalendarDate(anchor, timezone);
  if (lastDate < firstDate) return null;
  return { start: { date: firstDate }, end: { date: nextDate(lastDate) }, allDay: true, transparency: 'transparent', recurrence: calendarRecurrence(task.rrule, true, timezone), deadline: kind === 'deadline' && !task.is_all_day ? anchor : null };
}

export function taskCalendarDescription(notes: string | null | undefined, projection: TaskCalendarProjection, timezone: string): string | undefined {
  const zone = validTimezone(timezone);
  const deadline = projection.deadline ? `Deadline: ${new Date(projection.deadline).toLocaleString('en-GB', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })} (${zone})` : null;
  return [notes, deadline].filter(Boolean).join('\n') || undefined;
}
