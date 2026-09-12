type Dates = { start_at?: string | null; due_at?: string | null; is_all_day?: boolean };
const DAY = 86400000;
function timestamp(value: string | null | undefined) {
  return typeof value === "string" && value ? Date.parse(value) : NaN;
}

/** A task's availability-to-deadline range is not a continuous calendar booking.
 * Legacy overdue moves can leave starts weeks behind. Keep the deadline visible
 * without treating that stale interval as occupied time. Real events are separate.
 */
export function calendarTask<T extends Dates>(task: T): T {
  const start = timestamp(task.start_at), due = timestamp(task.due_at);
  if (task.is_all_day || (Number.isFinite(due) && (!Number.isFinite(start) || due < start || due - start >= DAY))) {
    return { ...task, start_at: null };
  }
  return task;
}

/** Partial reschedules move the other end of a valid work block too.
 * Explicit nulls are respected; moving a date never silently extends a deadline.
 */
export function resolveTaskDates<T extends Dates>(current: Dates, changes: T): T & Dates {
  const patch = { ...changes };
  for (const key of ['start_at', 'due_at'] as const) {
    if (key in patch && patch[key] != null && !Number.isFinite(timestamp(patch[key]))) throw new Error(`${key} must be a valid date`);
  }
  const oldStart = timestamp(current.start_at), oldDue = timestamp(current.due_at);
  const duration = oldDue - oldStart;
  const block = Number.isFinite(duration) && duration >= 0 && duration < DAY && !current.is_all_day;
  if ('due_at' in patch && !('start_at' in patch) && patch.due_at && current.start_at) {
    patch.start_at = block ? new Date(timestamp(patch.due_at) - duration).toISOString() : null;
  } else if ('start_at' in patch && !('due_at' in patch) && patch.start_at && current.due_at) {
    if (block) patch.due_at = new Date(timestamp(patch.start_at) + duration).toISOString();
  }
  const start = timestamp('start_at' in patch ? patch.start_at : current.start_at);
  const due = timestamp('due_at' in patch ? patch.due_at : current.due_at);
  if (Number.isFinite(start) && Number.isFinite(due) && start > due) throw new Error('Start must not be after due. Set both dates to move the work block.');
  return patch;
}
