import { addCalendarDays, dayWindow, taskDate, validDate, validTimezone } from "./day-window";
import { legacyCalendarTask } from './task-legacy-dates';
export type TaskTimeKind = 'deadline' | 'work' | 'span';
export type TaskDates = {
  start_at?: string | null;
  due_at?: string | null;
  is_all_day?: boolean | null;
  time_kind?: TaskTimeKind | null;
};

type ResolvedTaskDates<T extends TaskDates> = Omit<T, 'is_all_day'>
  & Pick<TaskDates, 'start_at' | 'due_at' | 'time_kind'>
  & { is_all_day?: 'is_all_day' extends keyof T ? T['is_all_day'] | boolean : boolean };

export function timestamp(value: string | null | undefined) {
  return typeof value === 'string' && value ? Date.parse(value) : NaN;
}

/** Read recorded intent only. Historical interval length never classifies it. */
export function taskTimeKind(task: TaskDates): TaskTimeKind | null {
  return task.time_kind ?? null;
}

/** Intent from fresh user-supplied creation input, never from a stored row. */
export function newTaskTimeKind(input: TaskDates): TaskTimeKind {
  const paired = input.start_at && input.due_at && timestamp(input.due_at) > timestamp(input.start_at);
  return input.time_kind ?? (paired ? input.is_all_day ? 'span' : 'work' : 'deadline');
}

/** Read-only calendar projection. Keep the actual due time on the task. */
export function calendarTask<T extends TaskDates>(task: T): T {
  if (task.time_kind == null) return legacyCalendarTask(task);
  const kind = taskTimeKind(task);
  if (kind === 'deadline') return { ...task, start_at: null, due_at: task.due_at ?? task.start_at, is_all_day: true };
  if (kind === 'span') return { ...task, is_all_day: true };
  return task;
}

/** Creation never fills an absent endpoint. Two supplied endpoints are an
 * explicit interval unless the caller specifies deadline intent. */
export function createTaskDates<T extends TaskDates>(input: T): ResolvedTaskDates<T> {
  if (input.time_kind === 'work' && (!input.start_at || !input.due_at)) throw new Error('Scheduled work needs both dates.');
  // These are newly supplied creation endpoints, not historical stored dates.
  const kind = newTaskTimeKind(input);
  const task = { ...input, time_kind: kind, ...(kind === 'span' ? { is_all_day: true } : kind === 'work' ? { is_all_day: false } : {}) };
  return resolveTaskDates({}, task);
}

/** Single-boundary rescheduling preserves exact work/span duration. Editors
 * changing a boundary independently pass both fields. Explicit nulls clear. */
export function resolveTaskDates<T extends TaskDates>(current: TaskDates, changes: T, timezone = Intl.DateTimeFormat().resolvedOptions().timeZone): ResolvedTaskDates<T> {
  const patch = { ...changes };
  if (patch.time_kind != null && !['deadline', 'work', 'span'].includes(patch.time_kind)) throw new Error('Invalid time_kind');
  for (const key of ['start_at', 'due_at'] as const) {
    const date = patch[key];
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date) && !validDate(date.slice(0, 10))) throw new Error(`${key} must be a valid calendar date`);
    if (key in patch && patch[key] != null && !Number.isFinite(timestamp(patch[key]))) throw new Error(`${key} must be a valid date`);
  }
  if (current.time_kind == null && !('time_kind' in patch)
    && ('start_at' in patch || 'due_at' in patch || 'is_all_day' in patch)) {
    // A due/availability edit is a deadline. A new pair of endpoints can be a
    // deliberate interval; copying an unchanged endpoint from an editor cannot.
    const newPair = patch.start_at && patch.due_at
      && timestamp(patch.start_at) !== timestamp(current.start_at) && timestamp(patch.due_at) !== timestamp(current.due_at);
    patch.time_kind = newPair ? (patch.is_all_day ?? current.is_all_day) ? 'span' : 'work' : 'deadline';
  }
  const oldStart = timestamp(current.start_at), oldDue = timestamp(current.due_at);
  const duration = oldDue - oldStart;
  let kind = patch.time_kind ?? taskTimeKind(current) ?? 'deadline';
  if (kind === 'work' && (patch.start_at === null || patch.due_at === null) && patch.time_kind !== 'work') {
    patch.time_kind = kind = 'deadline';
  }
  const interval = kind !== 'deadline' && Number.isFinite(duration) && duration >= 0;
  const zone = validTimezone(timezone);
  const shift = (anchor: string, direction: number) => {
    if (kind !== 'span') return new Date(timestamp(anchor) + direction * duration).toISOString();
    const days = (Date.parse(taskDate(current.due_at!, zone)) - Date.parse(taskDate(current.start_at!, zone))) / 86400000;
    const date = addCalendarDays(taskDate(anchor, zone), direction * days);
    return validDate(anchor) ? date : dayWindow(date, zone).start.toISOString();
  };
  if (interval && patch.due_at && !('start_at' in patch)) patch.start_at = shift(patch.due_at, -1);
  if (interval && patch.start_at && !('due_at' in patch)) patch.due_at = shift(patch.start_at, 1);
  const result = { ...current, ...patch };
  const start = timestamp(result.start_at), due = timestamp(result.due_at);
  if (Number.isFinite(start) && Number.isFinite(due) && start > due) throw new Error('Start must not be after due. Set both dates to move the interval.');
  if (kind === 'work' && (!Number.isFinite(start) || !Number.isFinite(due))) throw new Error('Scheduled work needs both dates.');
  if (kind === 'work' && start === due) throw new Error('Work needs an end after its start.');
  // Intent-only API/MCP conversions must agree with the editor's date mode.
  if (patch.time_kind === 'work') patch.is_all_day = false;
  if (patch.time_kind === 'span') patch.is_all_day = true;
  return patch as ResolvedTaskDates<T>;
}

/** Snoozing an overdue task anchors N days from today. */
export function snoozedDue(due: string | null, days: number, now = new Date()): Date {
  const old = due ? new Date(due) : null;
  const base = old && Number.isFinite(+old) && +old > +now ? new Date(old) : new Date(now);
  if (old && Number.isFinite(+old)) base.setHours(old.getHours(), old.getMinutes(), old.getSeconds(), old.getMilliseconds());
  else base.setHours(9, 0, 0, 0);
  base.setDate(base.getDate() + days);
  return base;
}
