import { RRule } from 'rrule';
import { calendarDate, taskDate, validDate, dayWindow, validTimezone } from './day-window';
import { taskTimeKind, timestamp, type TaskDates } from './task-schedule';
import { legacyCalendarTask } from './task-legacy-dates';

export { validTimezone } from './day-window';

/** Broaden overlap selection only for explicitly classified ranges. */
export function taskCalendarWindowFilter(min: string, max: string): string {
  return `and(start_at.gte.${min},start_at.lte.${max}),and(due_at.gte.${min},due_at.lte.${max}),and(time_kind.not.is.null,start_at.lt.${min},due_at.gt.${max}),rrule.not.is.null`;
}

/** Date-only values are civil dates, never UTC instants to be shifted. */
export function taskCalendarDate(value: string, timezone: string): string {
  return taskDate(value, timezone);
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
  legacy?: true;
};

type CalendarTask = TaskDates & { is_completed?: boolean; status?: string | null; parent_id?: string | null; rrule?: string | null; estimated_minutes?: number | null };

/** eae82d4 ICS compatibility only. Its bounded fallback is deliberately kept
 * separate from intent semantics: this never classifies or writes a task. */
function projectLegacyIcs(task: CalendarTask, timezone: string): TaskCalendarProjection | null {
  const display = legacyCalendarTask(task);
  const anchor = display.start_at ?? display.due_at ?? task.start_at;
  const start = timestamp(anchor);
  if (!Number.isFinite(start)) return null;
  const due = timestamp(display.due_at);
  const minutes = display.estimated_minutes && Number.isFinite(display.estimated_minutes) && display.estimated_minutes > 0
    ? Math.min(display.estimated_minutes, 23 * 60 + 59) : 30;
  const end = display.start_at && display.due_at && due > start ? due : start + minutes * 60000;
  const allDay = !!display.is_all_day;
  const date = calendarDate(new Date(start), validTimezone(timezone));
  return {
    start: allDay ? { date } : { dateTime: new Date(start).toISOString() },
    end: allDay ? { date: nextDate(date) } : { dateTime: new Date(end).toISOString() },
    allDay, transparency: allDay || !display.start_at ? 'transparent' : 'opaque',
    recurrence: calendarRecurrence(display.rrule, allDay, timezone), deadline: null, legacy: true,
  };
}

/** Shared ICS/Google projection. Task span ends are inclusive; calendar DATE
 * ends are exclusive. Effort estimates never create occupied calendar time. */
export function projectTaskCalendar(task: CalendarTask, timezone = 'UTC'): TaskCalendarProjection | null {
  if (task.parent_id || task.is_completed || task.status === 'done' || task.status === 'archived') return null;
  if (task.time_kind == null) return projectLegacyIcs(task, timezone);
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
