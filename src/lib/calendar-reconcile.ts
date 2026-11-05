import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  GoogleCalendarEvent,
  GoogleCalendarEventInput,
} from './google-calendar';
import type { TaskRowForPush } from './calendar-write';
import { addCalendarDays, dayWindow } from './day-window';

/** Only fields First Light writes. Provider-only fields are never overwritten. */
export function eventBaseline(
  event: GoogleCalendarEventInput | GoogleCalendarEvent,
) {
  const recurring = !!event.recurrence?.length;
  const boundary = (value: GoogleCalendarEvent['start']) =>
    value?.date
      ? { date: value.date }
      : value?.dateTime
        ? {
            dateTime: new Date(value.dateTime).toISOString(),
            ...(recurring ? { timeZone: value.timeZone ?? 'UTC' } : {}),
          }
        : null;
  return {
    summary: event.summary ?? '',
    description: event.description ?? '',
    start: boundary(event.start),
    end: boundary(event.end),
    recurrence: [...(event.recurrence ?? [])].sort(),
    transparency: event.transparency ?? 'opaque',
  };
}
export type EventBaseline = ReturnType<typeof eventBaseline>;
// jsonb does not preserve object key order. A database round trip must not
// turn an acknowledged echo into a conflict.
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)]),
    );
  return value;
}
export const sameEvent = (a: unknown, b: unknown) =>
  JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
export class CalendarConflict extends Error {
  constructor(
    public reason: string,
    public remote?: GoogleCalendarEvent,
  ) {
    super(reason);
  }
}
export function verifyMirror(
  task: TaskRowForPush,
  event: GoogleCalendarEvent,
  calendarId: string,
) {
  if (task.calendar_id && task.calendar_id !== calendarId)
    throw new CalendarConflict('calendar_mapping_changed', event);
  if (event.extendedProperties?.private?.firstlightTaskId !== task.id)
    throw new CalendarConflict('unverified_task_tag', event);
  if (task.calendar_event_id !== event.id)
    throw new CalendarConflict('event_mapping_changed', event);
}

/** Expanded instances have their own identity. A normal occurrence is an echo
 * of its master. Detached/moved/cancelled occurrences cannot move a series task. */
export function ordinaryInstance(
  instance: GoogleCalendarEvent,
  master: GoogleCalendarEvent,
) {
  if (instance.status === 'cancelled' || !instance.originalStartTime)
    return false;
  const original = instance.originalStartTime;
  if (instance.start?.date) {
    if (
      instance.start.date !== original.date ||
      !master.start?.date ||
      !master.end?.date ||
      !instance.end?.date
    )
      return false;
    if (
      Date.parse(instance.end.date) - Date.parse(instance.start.date) !==
      Date.parse(master.end.date) - Date.parse(master.start.date)
    )
      return false;
  } else {
    if (
      !original.dateTime ||
      !instance.start?.dateTime ||
      !instance.end?.dateTime ||
      !master.start?.dateTime ||
      !master.end?.dateTime
    )
      return false;
    if (Date.parse(original.dateTime) !== Date.parse(instance.start.dateTime))
      return false;
    if (
      Date.parse(instance.end.dateTime) -
        Date.parse(instance.start.dateTime) !==
      Date.parse(master.end.dateTime) - Date.parse(master.start.dateTime)
    )
      return false;
  }
  return (
    (instance.summary ?? '') === (master.summary ?? '') &&
    (instance.description ?? '') === (master.description ?? '') &&
    (instance.transparency ?? 'opaque') === (master.transparency ?? 'opaque')
  );
}

export function inboundTaskPatch(
  task: TaskRowForPush,
  event: GoogleCalendarEvent,
  baseline: EventBaseline,
  zone: string,
) {
  const remote = eventBaseline(event);
  if (
    !sameEvent(remote.recurrence, baseline.recurrence) ||
    remote.transparency !== baseline.transparency
  )
    throw new CalendarConflict('unsupported_intent_or_recurrence_edit', event);
  const datesChanged = !sameEvent(
    [remote.start, remote.end],
    [baseline.start, baseline.end],
  );
  const patch: Record<string, unknown> = {
    title: remote.summary,
    notes: remote.description || null,
  };
  // Timed deadlines project to DATE with an explanatory line; do not silently
  // interpret dragging that DATE as a new due time or import generated text.
  if (task.time_kind === 'deadline' && !task.is_all_day) {
    if (datesChanged || remote.description !== baseline.description)
      throw new CalendarConflict('timed_deadline_requires_task_edit', event);
    patch.notes = task.notes;
  } else if (datesChanged) {
    if (task.time_kind === 'work') {
      if (
        !event.start?.dateTime ||
        !event.end?.dateTime ||
        Date.parse(event.end.dateTime) <= Date.parse(event.start.dateTime)
      )
        throw new CalendarConflict('unsupported_date_mode_change', event);
      if (task.rrule && event.start.timeZone !== task.schedule_timezone)
        throw new CalendarConflict('series_timezone_changed', event);
      Object.assign(patch, {
        start_at: new Date(event.start.dateTime).toISOString(),
        due_at: new Date(event.end.dateTime).toISOString(),
        start_date: null,
        due_date: null,
      });
    } else if (
      (task.time_kind === 'span' ||
        (task.time_kind === 'deadline' && task.is_all_day)) &&
      event.start?.date &&
      event.end?.date
    ) {
      const end = addCalendarDays(event.end.date, -1);
      if (
        end < event.start.date ||
        (task.time_kind === 'deadline' && end !== event.start.date)
      )
        throw new CalendarConflict('unsupported_date_mode_change', event);
      Object.assign(patch, {
        due_date: end,
        due_at: dayWindow(
          end,
          task.schedule_timezone || zone,
        ).start.toISOString(),
        ...(task.time_kind === 'span'
          ? {
              start_date: event.start.date,
              start_at: dayWindow(
                event.start.date,
                task.schedule_timezone || zone,
              ).start.toISOString(),
            }
          : {}),
      });
    } else throw new CalendarConflict('legacy_or_changed_time_intent', event);
  }
  if (patch.due_at && task.reminder_offset_min != null)
    Object.assign(patch, {
      reminder_at: new Date(
        Date.parse(patch.due_at as string) - task.reminder_offset_min * 60000,
      ).toISOString(),
      reminder_sent_at: null,
    });
  return patch;
}

export async function recordCalendarConflict(
  supabase: SupabaseClient,
  task: TaskRowForPush,
  error: CalendarConflict,
) {
  const { data, error: dbError } = await supabase
    .from('tasks')
    .update({
      // Shared task readers must not receive provider-only fields (attendees,
      // locations or private properties) through a conflict snapshot. Review
      // can refetch the revision through the owner's calendar connection.
      calendar_conflict: {
        reason: error.reason,
        remote: error.remote
          ? {
              id: error.remote.id,
              etag: error.remote.etag ?? null,
              status: error.remote.status ?? null,
            }
          : null,
      },
    })
    .eq('user_id', task.user_id)
    .eq('id', task.id)
    .eq('updated_at', task.updated_at)
    .select('id');
  if (dbError) throw dbError;
  if (!data?.length) throw new Error('task_changed_during_conflict');
}

export async function reconcileTaskMirror(
  supabase: SupabaseClient,
  task: TaskRowForPush,
  event: GoogleCalendarEvent,
  calendarId: string,
  local: GoogleCalendarEventInput | null,
  zone: string,
): Promise<'acknowledged' | 'updated' | 'pending' | 'conflict'> {
  try {
    verifyMirror(task, event, calendarId);
    // An incremental pull of another ordinary occurrence is not proof that
    // a previously changed exception was reviewed or restored.
    if (
      task.calendar_conflict?.reason ===
      'recurring_occurrence_edit_requires_review'
    )
      return 'conflict';
    if (event.status === 'cancelled')
      throw new CalendarConflict('remote_deleted_task_retained', event);
    if (!event.etag) throw new CalendarConflict('missing_remote_etag', event);
    const remote = eventBaseline(event),
      desired = local ? eventBaseline(local) : null;
    const baseline = task.calendar_baseline;
    let patch: Record<string, unknown> = {};
    const equal = sameEvent(remote, desired);
    if (!equal) {
      if (!baseline || !task.calendar_etag)
        throw new CalendarConflict('missing_acknowledged_baseline', event);
      if (sameEvent(remote, baseline)) return 'pending';
      if (
        !sameEvent(desired, baseline) ||
        !local ||
        task.is_completed ||
        task.status === 'done' ||
        task.status === 'archived'
      )
        throw new CalendarConflict('both_sides_changed', event);
      patch = inboundTaskPatch(task, event, baseline, zone);
    }
    const { data, error } = await supabase.rpc('reconcile_task_calendar', {
      p_user_id: task.user_id,
      p_task_id: task.id,
      p_expected_updated_at: task.updated_at,
      p_calendar_id: calendarId,
      p_event_id: event.id,
      p_etag: event.etag,
      p_baseline: remote,
      p_patch: patch,
    });
    if (error) throw error;
    if (!data) throw new Error('task_changed_during_sync');
    return equal ? 'acknowledged' : 'updated';
  } catch (error) {
    if (!(error instanceof CalendarConflict)) throw error;
    await recordCalendarConflict(supabase, task, error);
    return 'conflict';
  }
}
