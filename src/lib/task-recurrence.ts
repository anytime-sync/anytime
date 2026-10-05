import { rrulestr } from 'rrule';
import { resolveTaskDates, taskTimeKind, type TaskDates } from './task-schedule';
import { dayWindow, instantFromWallClock, taskDate, validTimezone, wallClock } from './day-window';
import { calendarRecurrence } from './task-calendar';

/** The existing INSERT status trigger treats default status=open as canonical.
 * Set both aliases so completed history cannot become an active calendar task. */
export function completedTaskOccurrence<T extends TaskDates & { project_id?: string | null; title: string; notes?: string | null; priority?: number }>(task: T, userId: string, completedAt: string) {
  return { user_id: userId, project_id: task.project_id, title: task.title, notes: task.notes, priority: task.priority,
    start_at: task.start_at, due_at: task.due_at, is_all_day: task.is_all_day, time_kind: task.time_kind,
    status: 'done' as const, is_completed: true, completed_at: completedAt, position: 0, rrule: null, calendar_event_id: null };
}

/** COUNT is the remaining occurrence count for the advancing task row. The
 * completed one-off clone has no RRULE; never restart COUNT on every completion. */
export function nextTaskRecurrence(task: TaskDates & { rrule?: string | null }, timezone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  if (!task.rrule || !task.due_at) return null;
  const zone = validTimezone(timezone);
  const kind = taskTimeKind(task);
  const allDay = kind === 'span' || !!task.is_all_day;
  const ruleText = calendarRecurrence(task.rrule, allDay, zone);
  if (!ruleText) return null;
  const count = /(?:^|;)COUNT=(\d+)(?:;|$)/i.exec(ruleText);
  if (count && Number(count[1]) <= 1) return null;
  try {
    const anchor = kind !== 'deadline' && task.start_at ? task.start_at : task.due_at;
    const from = new Date(anchor);
    const civil = allDay ? new Date(`${taskDate(anchor, zone)}T00:00:00Z`) : wallClock(from, zone);
    // Expand in civil time, then resolve using the account zone ourselves:
    // rrule's TZID conversion depends on the browser/server's host timezone.
    const until = /(?:^|;)UNTIL=(\d{8}(?:T\d{6}Z)?)(?:;|$)/i.exec(ruleText)?.[1];
    const limit = !until ? null : until.length === 8
      ? +dayWindow(`${until.slice(0, 4)}-${until.slice(4, 6)}-${until.slice(6, 8)}`, zone).nextStart - 1
      : Date.parse(`${until.slice(0, 4)}-${until.slice(4, 6)}-${until.slice(6, 8)}T${until.slice(9, 11)}:${until.slice(11, 13)}:${until.slice(13, 15)}Z`);
    // COUNT is decremented only after a real occurrence is completed, so a
    // nonexistent civil-time candidate must not consume the remaining count.
    const withoutLimits = ruleText.split(';').filter(part => !/^(UNTIL|COUNT)=/i.test(part)).join(';');
    const rule = rrulestr(`DTSTART:${civil.toISOString().replace(/[-:]|\.\d{3}/g, '')}\nRRULE:${withoutLimits}`);
    let candidate = rule.after(civil, false);
    let next: Date | null = null;
    // RFC 5545 omits nonexistent local times instead of moving them an hour.
    for (let i = 0; candidate && i < 8; i++) {
      candidate.setUTCMilliseconds(civil.getUTCMilliseconds());
      next = instantFromWallClock(candidate, zone);
      if (next) break;
      candidate = rule.after(candidate, false);
    }
    if (!next || (limit != null && +next > limit)) return null;
    const rrule = count ? ruleText.replace(/COUNT=\d+/i, `COUNT=${Number(count[1]) - 1}`) : ruleText;
    return { next, patch: { ...resolveTaskDates(task, kind === 'deadline' ? { due_at: next.toISOString() } : { start_at: next.toISOString() }, zone), rrule } };
  } catch { return null; }
}
