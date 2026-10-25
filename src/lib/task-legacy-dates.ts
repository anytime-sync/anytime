import type { TaskDates } from './task-schedule';

const DAY = 86400000;
const timestamp = (value: string | null | undefined) => typeof value === 'string' && value ? Date.parse(value) : NaN;

/** Frozen eae82d4 display compatibility, not an intent classifier. Unknown
 * historical rows keep their old output until a deliberate edit records intent. */
export function legacyCalendarTask<T extends TaskDates>(task: T): T {
  const start = timestamp(task.start_at), due = timestamp(task.due_at);
  if (task.is_all_day || (Number.isFinite(due) && (!Number.isFinite(start) || due < start || due - start >= DAY))) {
    return { ...task, start_at: null };
  }
  return task;
}

/** Preserve old Google eligibility without assigning work/deadline intent. */
export function legacyGoogleBlock(task: TaskDates): boolean {
  const duration = timestamp(task.due_at) - timestamp(task.start_at);
  return !task.is_all_day && Number.isFinite(duration) && duration > 0 && duration < DAY;
}

/** Automatic recurrence is not a user intent classification. Keep legacy
 * short windows moving as before; retain availability dates for other rows. */
export function legacyRecurrenceDates(task: TaskDates, next: string) {
  const duration = timestamp(task.due_at) - timestamp(task.start_at);
  return {
    due_at: next,
    time_kind: null,
    ...(!task.is_all_day && Number.isFinite(duration) && duration >= 0 && duration < DAY
      ? { start_at: new Date(Date.parse(next) - duration).toISOString() } : {}),
  };
}
