import { validDate } from "./day-window";
export type TaskTimeKind = 'deadline' | 'work' | 'span';
export type TaskDates = {
  start_at?: string | null;
  due_at?: string | null;
  is_all_day?: boolean | null;
  time_kind?: TaskTimeKind | null;
};

export function timestamp(value: string | null | undefined) {
  return typeof value === 'string' && value ? Date.parse(value) : NaN;
}

/** Null means legacy/unknown intent. Preserve positive intervals regardless of
 * length; duration alone cannot distinguish real work from a lifecycle range. */
export function taskTimeKind(task: TaskDates): TaskTimeKind {
  if (task.time_kind) return task.time_kind;
  const start = timestamp(task.start_at), due = timestamp(task.due_at);
  if (Number.isFinite(start) && Number.isFinite(due) && due > start) {
    return task.is_all_day ? 'span' : 'work';
  }
  return 'deadline';
}

/** Read-only calendar projection. Keep the actual due time on the task. */
export function calendarTask<T extends TaskDates>(task: T): T {
  const kind = taskTimeKind(task);
  if (kind === 'deadline') return { ...task, start_at: null, due_at: task.due_at ?? task.start_at, is_all_day: true };
  if (kind === 'span') return { ...task, is_all_day: true };
  return task;
}

/** Creation never fills an absent endpoint. Two supplied endpoints are an
 * explicit interval unless the caller specifies deadline intent. */
export function createTaskDates<T extends TaskDates>(input: T): T & Pick<TaskDates, 'start_at' | 'due_at' | 'time_kind'> {
  if (input.time_kind === 'work' && (!input.start_at || !input.due_at)) throw new Error('Scheduled work needs both dates.');
  const kind = input.time_kind ?? taskTimeKind(input);
  const task = { ...input, time_kind: kind, ...(kind === 'span' ? { is_all_day: true } : kind === 'work' ? { is_all_day: false } : {}) };
  return resolveTaskDates({}, task);
}

/** Single-boundary rescheduling preserves exact work/span duration. Editors
 * changing a boundary independently pass both fields. Explicit nulls clear. */
export function resolveTaskDates<T extends TaskDates>(current: TaskDates, changes: T): T & Pick<TaskDates, 'start_at' | 'due_at' | 'time_kind'> {
  const patch = { ...changes };
  if (patch.time_kind != null && !['deadline', 'work', 'span'].includes(patch.time_kind)) throw new Error('Invalid time_kind');
  for (const key of ['start_at', 'due_at'] as const) {
    const date = patch[key];
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date) && !validDate(date.slice(0, 10))) throw new Error(`${key} must be a valid calendar date`);
    if (key in patch && patch[key] != null && !Number.isFinite(timestamp(patch[key]))) throw new Error(`${key} must be a valid date`);
  }
  const oldStart = timestamp(current.start_at), oldDue = timestamp(current.due_at);
  const duration = oldDue - oldStart;
  const kind = patch.time_kind ?? taskTimeKind(current);
  const interval = kind !== 'deadline' && Number.isFinite(duration) && duration >= 0;
  if (interval && patch.due_at && !('start_at' in patch)) patch.start_at = new Date(timestamp(patch.due_at) - duration).toISOString();
  if (interval && patch.start_at && !('due_at' in patch)) patch.due_at = new Date(timestamp(patch.start_at) + duration).toISOString();
  const result = { ...current, ...patch };
  const start = timestamp(result.start_at), due = timestamp(result.due_at);
  if (Number.isFinite(start) && Number.isFinite(due) && start > due) throw new Error('Start must not be after due. Set both dates to move the interval.');
  if (kind === 'work' && Number.isFinite(start) && Number.isFinite(due) && start === due) throw new Error('Work needs an end after its start.');
  if (kind === 'work' && (patch.start_at === null || patch.due_at === null)) patch.time_kind = 'deadline';
  return patch;
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
