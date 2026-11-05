import {
  addCalendarDays,
  dayWindow,
  taskDate,
  validDate,
  validTimezone,
  resolveLocalInput,
  calendarDate,
  wallClock,
} from './day-window';
import { legacyCalendarTask } from './task-legacy-dates';
export type TaskTimeKind = 'deadline' | 'work' | 'span';
export type TaskDates = {
  /** Canonical civil dates for explicit all-day intent. Timestamp columns are compatibility mirrors. */
  start_date?: string | null;
  due_date?: string | null;
  schedule_timezone?: string | null;
  reminder_offset_min?: number | null;
  reminder_at?: string | null;
  reminder_sent_at?: string | null;
  start_at?: string | null;
  due_at?: string | null;
  is_all_day?: boolean | null;
  time_kind?: TaskTimeKind | null;
};

type ResolvedTaskDates<T extends TaskDates> = Omit<T, 'is_all_day'> &
  Pick<
    TaskDates,
    | 'start_at'
    | 'due_at'
    | 'time_kind'
    | 'start_date'
    | 'due_date'
    | 'schedule_timezone'
    | 'reminder_at'
    | 'reminder_sent_at'
  > & {
    is_all_day?: 'is_all_day' extends keyof T
      ? T['is_all_day'] | boolean
      : boolean;
  };

export function timestamp(value: string | null | undefined) {
  return typeof value === 'string' && value ? Date.parse(value) : NaN;
}

/** Read recorded intent only. Historical interval length never classifies it. */
export function taskTimeKind(task: TaskDates): TaskTimeKind | null {
  return task.time_kind ?? null;
}

/** Intent from fresh user-supplied creation input, never from a stored row. */
export function newTaskTimeKind(input: TaskDates): TaskTimeKind {
  const start = input.start_date ?? input.start_at,
    due = input.due_date ?? input.due_at;
  const paired = start && due && timestamp(due) > timestamp(start);
  return (
    input.time_kind ??
    (paired ? (input.is_all_day ? 'span' : 'work') : 'deadline')
  );
}

/** Read-only calendar projection. Keep the actual due time on the task. */
export function calendarTask<T extends TaskDates>(task: T): T {
  if (task.time_kind == null) return legacyCalendarTask(task);
  const kind = taskTimeKind(task);
  if (kind === 'deadline')
    return {
      ...task,
      start_at: null,
      due_at: task.due_at ?? task.start_at,
      is_all_day: true,
    };
  if (kind === 'span') return { ...task, is_all_day: true };
  return task;
}

/** Creation never fills an absent endpoint. Two supplied endpoints are an
 * explicit interval unless the caller specifies deadline intent. */
export function createTaskDates<T extends TaskDates>(
  input: T,
  timezone?: string,
): ResolvedTaskDates<T> {
  if (input.time_kind === 'work' && (!input.start_at || !input.due_at))
    throw new Error('Scheduled work needs both dates.');
  // These are newly supplied creation endpoints, not historical stored dates.
  const kind = newTaskTimeKind(input);
  const task = {
    ...input,
    time_kind: kind,
    ...(kind === 'span'
      ? { is_all_day: true }
      : kind === 'work'
        ? { is_all_day: false }
        : {}),
  };
  return resolveTaskDates({}, task, timezone);
}

/** Single-boundary rescheduling preserves exact work/span duration. Editors
 * changing a boundary independently pass both fields. Explicit nulls clear. */
export function resolveTaskDates<T extends TaskDates>(
  current: TaskDates,
  changes: T,
  timezone?: string,
): ResolvedTaskDates<T> {
  const patch: TaskDates & T = { ...changes };
  const zone = validTimezone(
    changes.schedule_timezone ?? current.schedule_timezone ?? timezone ?? 'UTC',
  );
  for (const [civilKey, instantKey] of [
    ['start_date', 'start_at'],
    ['due_date', 'due_at'],
  ] as const) {
    if (civilKey in patch) {
      if (patch[civilKey] != null && !validDate(patch[civilKey]!))
        throw new Error(`${civilKey} must be a valid calendar date`);
      if (patch[civilKey] != null)
        patch[instantKey] = dayWindow(
          patch[civilKey]!,
          zone,
        ).start.toISOString();
      else if (!(instantKey in patch)) patch[instantKey] = null;
    }
  }
  if (
    patch.time_kind != null &&
    !['deadline', 'work', 'span'].includes(patch.time_kind)
  )
    throw new Error('Invalid time_kind');
  for (const key of ['start_at', 'due_at'] as const) {
    if (
      typeof patch[key] === 'string' &&
      !validDate(patch[key]!) &&
      !/(Z|[+-]\d{2}:\d{2})$/i.test(patch[key]!)
    )
      patch[key] = resolveLocalInput(patch[key]!, zone);
    const date = patch[key];
    if (
      typeof date === 'string' &&
      /^\d{4}-\d{2}-\d{2}/.test(date) &&
      !validDate(date.slice(0, 10))
    )
      throw new Error(`${key} must be a valid calendar date`);
    if (
      key in patch &&
      patch[key] != null &&
      !Number.isFinite(timestamp(patch[key]))
    )
      throw new Error(`${key} must be a valid date`);
  }
  if (
    current.time_kind == null &&
    !('time_kind' in patch) &&
    ('start_at' in patch || 'due_at' in patch || 'is_all_day' in patch)
  ) {
    // A due/availability edit is a deadline. A new pair of endpoints can be a
    // deliberate interval; copying an unchanged endpoint from an editor cannot.
    const newPair =
      patch.start_at &&
      patch.due_at &&
      timestamp(patch.start_at) !== timestamp(current.start_at) &&
      timestamp(patch.due_at) !== timestamp(current.due_at);
    patch.time_kind = newPair
      ? (patch.is_all_day ?? current.is_all_day)
        ? 'span'
        : 'work'
      : 'deadline';
  }
  const oldStart = timestamp(current.start_at),
    oldDue = timestamp(current.due_at);
  const duration = oldDue - oldStart;
  let kind = patch.time_kind ?? taskTimeKind(current) ?? 'deadline';
  if (
    kind === 'work' &&
    (patch.start_at === null || patch.due_at === null) &&
    patch.time_kind !== 'work'
  ) {
    patch.time_kind = kind = 'deadline';
  }
  const interval =
    kind !== 'deadline' && Number.isFinite(duration) && duration >= 0;
  const shift = (anchor: string, direction: number) => {
    if (kind !== 'span')
      return new Date(timestamp(anchor) + direction * duration).toISOString();
    const days =
      (Date.parse(current.due_date ?? taskDate(current.due_at!, zone)) -
        Date.parse(current.start_date ?? taskDate(current.start_at!, zone))) /
      86400000;
    const date = addCalendarDays(taskDate(anchor, zone), direction * days);
    return validDate(anchor) ? date : dayWindow(date, zone).start.toISOString();
  };
  if (interval && patch.due_at && !('start_at' in patch))
    patch.start_at = shift(patch.due_at, -1);
  if (interval && patch.start_at && !('due_at' in patch))
    patch.due_at = shift(patch.start_at, 1);
  const result = { ...current, ...patch };
  const start = timestamp(result.start_at),
    due = timestamp(result.due_at);
  if (Number.isFinite(start) && Number.isFinite(due) && start > due)
    throw new Error(
      'Start must not be after due. Set both dates to move the interval.',
    );
  if (kind === 'work' && (!Number.isFinite(start) || !Number.isFinite(due)))
    throw new Error('Scheduled work needs both dates.');
  if (kind === 'work' && start === due)
    throw new Error('Work needs an end after its start.');
  // Intent-only API/MCP conversions must agree with the editor's date mode.
  if (patch.time_kind === 'work') patch.is_all_day = false;
  if (patch.time_kind === 'span') patch.is_all_day = true;
  // Only explicit scheduling writes add intent. Untouched legacy rows remain unknown.
  if (
    timezone ||
    current.schedule_timezone ||
    changes.schedule_timezone ||
    'start_date' in changes ||
    'due_date' in changes
  ) {
    const allDay =
      kind === 'span' ||
      (kind !== 'work' && (patch.is_all_day ?? current.is_all_day));
    if (
      [
        'start_at',
        'due_at',
        'is_all_day',
        'time_kind',
        'start_date',
        'due_date',
      ].some((key) => key in patch)
    ) {
      patch.schedule_timezone = zone;
      for (const [civilKey, instantKey] of [
        ['start_date', 'start_at'],
        ['due_date', 'due_at'],
      ] as const) {
        if (instantKey in patch || 'is_all_day' in patch) {
          const value =
            patch[instantKey] === undefined
              ? current[instantKey]
              : patch[instantKey];
          patch[civilKey] =
            allDay && value ? (patch[civilKey] ?? taskDate(value, zone)) : null;
          if (patch[civilKey])
            patch[instantKey] = dayWindow(
              patch[civilKey]!,
              zone,
            ).start.toISOString();
        }
      }
    }
  }
  const reminderOffset =
    'reminder_offset_min' in patch
      ? patch.reminder_offset_min
      : current.reminder_offset_min;
  if (
    'due_at' in patch &&
    reminderOffset != null &&
    !('reminder_at' in patch)
  ) {
    patch.reminder_at = patch.due_at
      ? new Date(
          Date.parse(patch.due_at) - reminderOffset * 60000,
        ).toISOString()
      : null;
    patch.reminder_sent_at = null;
  }
  return patch as ResolvedTaskDates<T>;
}

/** Snoozing an overdue task anchors N days from today. */
export function snoozedDue(
  due: string | null,
  days: number,
  now = new Date(),
): Date {
  const old = due ? new Date(due) : null;
  const base =
    old && Number.isFinite(+old) && +old > +now ? new Date(old) : new Date(now);
  if (old && Number.isFinite(+old))
    base.setHours(
      old.getHours(),
      old.getMinutes(),
      old.getSeconds(),
      old.getMilliseconds(),
    );
  else base.setHours(9, 0, 0, 0);
  base.setDate(base.getDate() + days);
  return base;
}

/** Explicit snooze is a calendar reschedule in the account zone. Civil tasks
 * return civil fields; timed tasks retain their wall time and exact duration. */
export function snoozeTaskDates(
  task: TaskDates,
  days: number,
  zone: string,
  now = new Date(),
  fromToday = false,
): Pick<TaskDates, 'due_date' | 'due_at'> {
  const today = calendarDate(now, zone);
  const dueDate =
    task.due_date ?? (task.due_at ? taskDate(task.due_at, zone) : today);
  const target = addCalendarDays(
    fromToday || dueDate < today ? today : dueDate,
    days,
  );
  if (task.is_all_day || task.time_kind === 'span') return { due_date: target };
  const time = task.due_at
    ? wallClock(new Date(task.due_at), zone).toISOString().slice(11, 23)
    : '09:00:00.000';
  return { due_at: resolveLocalInput(`${target}T${time}`, zone) };
}
