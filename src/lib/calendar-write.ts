/** Task → Google sync uses the same calendar projection as the ICS feed.
 * New tasks and dirty linked tasks are retried across downtime. Existing rows
 * are not marked dirty by the migration; historical repair needs review. */
import type { SupabaseClient } from '@supabase/supabase-js';
import { getValidAccessToken } from './calendar-token';
import {
  createCalendarEvent,
  deleteCalendarEvent,
  getCalendarEvent,
  patchCalendarEvent,
  type GoogleCalendarEvent,
  type GoogleCalendarEventInput,
} from './google-calendar';

import {
  CalendarConflict,
  eventBaseline,
  sameEvent,
  recordCalendarConflict,
  type EventBaseline,
} from './calendar-reconcile';
import type { TaskDates } from './task-schedule';
import { createHash } from 'node:crypto';
import {
  projectTaskCalendar,
  taskCalendarDescription,
  validTimezone,
} from './task-calendar';
import { taskTimeKind, type TaskTimeKind } from './task-schedule';
import { legacyGoogleBlock } from './task-legacy-dates';

const FIRSTLIGHT_TAG_KEY = 'firstlightTaskId';

export type TaskRowForPush = TaskDates & {
  calendar_id?: string | null;
  calendar_etag?: string | null;
  calendar_baseline?: EventBaseline | null;
  calendar_conflict?: { reason: string } | null;
  calendar_pending?: {
    operation: 'create' | 'patch' | 'delete';
    event: EventBaseline | null;
  } | null;
  id: string;
  user_id: string;
  title: string;
  notes: string | null;
  start_at: string | null;
  due_at: string | null;
  time_kind?: TaskTimeKind | null;
  rrule?: string | null;
  status?: string | null;
  is_completed?: boolean;
  parent_id?: string | null;
  is_all_day: boolean | null;
  calendar_event_id: string | null;
  calendar_event_generation?: number;
  updated_at: string | null;
};

export function isOurOwnEventTag(
  privateProps?: Record<string, string>,
): string | null {
  if (!privateProps) return null;
  const id = privateProps[FIRSTLIGHT_TAG_KEY];
  return typeof id === 'string' && id.length > 0 ? id : null;
}

export function taskEventId(taskId: string, generation: number): string {
  // Preserve generation-zero identity from the initial implementation.
  return `fl${createHash('sha256')
    .update(generation ? `${taskId}:${generation}` : taskId)
    .digest('hex')}`;
}

export async function loadEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
): Promise<GoogleCalendarEvent | null> {
  try {
    return await getCalendarEvent({ accessToken, calendarId, eventId });
  } catch (error) {
    if (
      error instanceof Error &&
      /^google_get_event_failed: 404\b/.test(error.message)
    )
      return null;
    if (
      error instanceof Error &&
      /^google_get_event_failed: 410\b/.test(error.message)
    )
      return { id: eventId, status: 'cancelled' };
    throw error;
  }
}

function assertTaskOwner(event: GoogleCalendarEvent, taskId?: string) {
  const owner = isOurOwnEventTag(event.extendedProperties?.private);
  if (!owner || (taskId && owner !== taskId))
    throw new Error(
      'Calendar event ownership is unverified; review before changing it.',
    );
}

async function createTaskEvent(
  accessToken: string,
  calendarId: string,
  task: TaskRowForPush,
  event: GoogleCalendarEventInput,
  generation: number,
) {
  // Deletions leave tombstones, so never restore a cancelled resource. A new
  // persisted generation is stable for retries and distinct on reopening.
  for (let i = 0; i < 8; i++, generation++) {
    const eventId = taskEventId(task.id, generation);
    try {
      const created = await createCalendarEvent({
        accessToken,
        calendarId,
        event: { ...event, id: eventId },
        sendUpdates: 'none',
      });
      return { eventId, generation, remote: created };
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !/^google_create_event_failed: 409\b/.test(error.message)
      )
        throw error;
      const existing = await loadEvent(accessToken, calendarId, eventId);
      if (!existing)
        throw new Error(
          'Conflicting task calendar event is unavailable; retry pending.',
        );
      if (existing.status === 'cancelled') continue;
      assertTaskOwner(existing, task.id);
      const expected =
        task.calendar_pending?.operation === 'create'
          ? task.calendar_pending.event
          : eventBaseline(event);
      if (!sameEvent(eventBaseline(existing), expected))
        throw new CalendarConflict('create_recovery_remote_changed', existing);
      return { eventId, generation, remote: existing };
    }
  }
  throw new Error(
    'Repeated calendar tombstones need review; task remains pending.',
  );
}

/** Push at most 50 tasks. Dirty state is cleared only for the exact task
 * version sent, so an edit during a network request remains pending. */
export async function pushPendingTasksForUser({
  supabase,
  userId,
  primaryCalendarId,
  accessToken,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>;
  userId: string;
  primaryCalendarId: string;
  accessToken: string;
}): Promise<{
  created: number;
  patched: number;
  failed: number;
  conflicts: number;
}> {
  const { data: prefs, error: prefsError } = await supabase
    .from('user_preferences')
    .select('timezone')
    .eq('user_id', userId)
    .maybeSingle();
  if (prefsError) throw prefsError;
  const timezone = validTimezone(prefs?.timezone ?? 'UTC');
  const { data: needCreateRaw, error: createError } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .is('calendar_event_id', null)
    .eq('calendar_dirty', true)
    .is('parent_id', null)
    .eq('is_completed', false)
    .neq('status', 'done')
    .neq('status', 'archived')
    .or('start_at.not.is.null,due_at.not.is.null')
    .order('updated_at', { ascending: true })
    .limit(25);
  const { data: needPatchRaw, error: patchError } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .not('calendar_event_id', 'is', null)
    .eq('calendar_dirty', true)
    .order('updated_at', { ascending: true })
    .limit(25);
  if (createError || patchError) throw createError ?? patchError;
  let created = 0,
    patched = 0,
    failed = 0,
    conflicts = 0;
  for (const t of [
    ...(needCreateRaw ?? []),
    ...(needPatchRaw ?? []),
  ] as TaskRowForPush[]) {
    try {
      if (
        t.calendar_conflict?.reason ===
        'recurring_occurrence_edit_requires_review'
      ) {
        conflicts++;
        continue;
      }
      const active =
        !t.is_completed &&
        t.status !== 'done' &&
        t.status !== 'archived' &&
        !t.parent_id;
      // Main never wrote these unclassified rows to Google. A metadata edit
      // must not create/delete an old event or silently classify its interval.
      const preserveLegacy =
        t.time_kind == null && active && !legacyGoogleBlock(t);
      const event = preserveLegacy ? null : buildEventInput(t, timezone);
      let eventId = t.calendar_event_id;
      let generation = t.calendar_event_generation ?? 0;
      let didCreate = false;
      let remote: GoogleCalendarEvent | null = null;
      let revision = t.updated_at;
      const ack = async (dirty: boolean) => {
        if (remote && !remote.etag) throw new Error('missing_remote_etag');
        const { data: saved, error } = await supabase
          .from('tasks')
          .update({
            calendar_event_id: eventId,
            calendar_id: eventId ? primaryCalendarId : null,
            calendar_event_generation: generation,
            calendar_etag: remote?.etag ?? null,
            calendar_baseline: remote ? eventBaseline(remote) : null,
            calendar_pending: null,
            calendar_conflict: null,
            calendar_dirty: dirty,
          })
          .eq('user_id', userId)
          .eq('id', t.id)
          .eq('updated_at', revision)
          .select('id');
        if (error) throw error;
        if (!saved?.length)
          throw new Error('Task changed during sync; retry pending.');
      };
      const prepare = async (operation: 'create' | 'patch' | 'delete') => {
        const pending = {
          operation,
          event: event ? eventBaseline(event) : null,
        };
        const { data, error } = await supabase
          .from('tasks')
          .update({ calendar_pending: pending })
          .eq('user_id', userId)
          .eq('id', t.id)
          .eq('updated_at', revision)
          .select('updated_at');
        if (error) throw error;
        if (!data?.[0]?.updated_at)
          throw new Error('Task changed before provider write; retry pending.');
        revision = data[0].updated_at;
        t.updated_at = revision;
      };
      if (preserveLegacy) {
        const { data, error } = await supabase
          .from('tasks')
          .update({ calendar_dirty: false })
          .eq('user_id', userId)
          .eq('id', t.id)
          .eq('updated_at', revision)
          .select('id');
        if (error || !data?.length)
          throw error ?? new Error('Task changed during sync; retry pending.');
        continue;
      }
      const linked = eventId
        ? await loadEvent(accessToken, primaryCalendarId, eventId)
        : null;
      if (eventId) {
        if (t.calendar_id && t.calendar_id !== primaryCalendarId)
          throw new CalendarConflict(
            'calendar_mapping_changed',
            linked ?? undefined,
          );
        if (!linked || linked.status === 'cancelled') {
          if (t.calendar_pending?.operation !== 'delete')
            throw new CalendarConflict(
              'remote_deleted_task_retained',
              linked ?? undefined,
            );
          eventId = null;
          generation++;
          await ack(!!event);
          continue;
        }
        assertTaskOwner(linked, t.id);
        const observed = eventBaseline(linked),
          desired = event ? eventBaseline(event) : null;
        // Recover a lost PATCH response without losing a later local edit.
        if (
          sameEvent(observed, desired) ||
          (t.calendar_pending?.operation === 'patch' &&
            sameEvent(observed, t.calendar_pending.event))
        ) {
          remote = linked;
          await ack(!sameEvent(observed, desired));
          patched++;
          continue;
        }
        if (!t.calendar_baseline || !t.calendar_etag)
          throw new CalendarConflict('missing_acknowledged_baseline', linked);
        if (!sameEvent(observed, t.calendar_baseline))
          throw new CalendarConflict('remote_changed_since_baseline', linked);
        await prepare(event ? 'patch' : 'delete');
        try {
          if (!event) {
            await deleteCalendarEvent({
              accessToken,
              calendarId: primaryCalendarId,
              eventId,
              ifMatch: linked.etag ?? t.calendar_etag,
              sendUpdates: 'none',
            });
            eventId = null;
            generation++;
          } else {
            remote = await patchCalendarEvent({
              accessToken,
              calendarId: primaryCalendarId,
              eventId,
              ifMatch: linked.etag ?? t.calendar_etag,
              patch: event,
              sendUpdates: 'none',
            });
            if (remote.status === 'cancelled')
              throw new CalendarConflict(
                'remote_deleted_task_retained',
                remote,
              );
          }
        } catch (error) {
          if (
            error instanceof Error &&
            error.message === 'google_precondition_failed'
          ) {
            const latest = await loadEvent(
              accessToken,
              primaryCalendarId,
              eventId!,
            );
            // An overlapping identical worker is an echo, never a blind retry.
            if (
              event &&
              latest?.etag &&
              latest.status !== 'cancelled' &&
              sameEvent(eventBaseline(latest), eventBaseline(event))
            )
              remote = latest;
            else
              throw new CalendarConflict(
                'remote_changed_during_write',
                latest ?? undefined,
              );
          } else throw error;
        }
      } else if (event) {
        if (!t.calendar_pending) await prepare('create');
        const result = await createTaskEvent(
          accessToken,
          primaryCalendarId,
          t,
          event,
          generation,
        );
        eventId = result.eventId;
        generation = result.generation;
        remote = result.remote;
        didCreate = true;
      }
      await ack(
        !!event &&
          !!remote &&
          !sameEvent(eventBaseline(event), eventBaseline(remote)),
      );
      if (event) {
        if (didCreate) created++;
        else patched++;
      }
    } catch (error) {
      if (error instanceof CalendarConflict) {
        try {
          await recordCalendarConflict(supabase, t, error);
          conflicts++;
        } catch {
          failed++;
        }
      } else {
        console.error('[calendar-write] task push failed', t.id, error);
        failed++;
      }
    }
  }
  return { created, patched, failed, conflicts };
}

/**
 * Drain pending_calendar_deletions. Runs after the per-user push pass
 * inside the cron loop. Uses the claim_pending_calendar_deletions RPC
 * for FOR UPDATE SKIP LOCKED semantics so multiple cron instances
 * don't double-delete.
 */
export async function drainCalendarDeletions({
  supabase,
  userId: onlyUserId,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>;
  userId?: string;
}): Promise<{ deleted: number; failed: number }> {
  const { data: claimedRaw, error } = onlyUserId
    ? await supabase
        .from('pending_calendar_deletions')
        .select('*')
        .eq('user_id', onlyUserId)
        .limit(50)
    : await supabase.rpc('claim_pending_calendar_deletions', {
        batch_size: 50,
      });
  if (error) {
    console.error('[calendar-write] claim queue failed', error);
    throw new Error(error.message);
  }
  const claimed = (claimedRaw ?? []) as Array<{
    id: string;
    user_id: string;
    calendar_id: string | null;
    event_id: string;
    attempts: number;
  }>;

  let deleted = 0;
  let failed = 0;

  // Group by user so we only refresh one access_token per user.
  const byUser = new Map<string, typeof claimed>();
  for (const row of claimed) {
    const list = byUser.get(row.user_id) ?? [];
    list.push(row);
    byUser.set(row.user_id, list);
  }

  for (const [userId, rows] of byUser) {
    let accessToken: string | null = null;
    try {
      accessToken = await getValidAccessToken({ supabase, userId });
    } catch (e) {
      console.error(
        '[calendar-write] token refresh failed for user',
        userId,
        e,
      );
      // Mark these rows with a last_error but leave them; next tick retries.
      for (const r of rows) {
        await supabase
          .from('pending_calendar_deletions')
          .update({ last_error: 'token_refresh_failed' })
          .eq('id', r.id)
          .eq('user_id', r.user_id);
        failed++;
      }
      continue;
    }
    if (!accessToken) {
      failed += rows.length;
      continue;
    }

    for (const r of rows) {
      const calendarId = r.calendar_id ?? 'primary';
      try {
        const event = await loadEvent(accessToken, calendarId, r.event_id);
        if (event && event.status !== 'cancelled') {
          const { data: baseline, error: baselineError } = await supabase
            .from('task_calendar_deletion_baselines')
            .select('*')
            .eq('user_id', r.user_id)
            .eq('event_id', r.event_id)
            .maybeSingle();
          if (baselineError) throw baselineError;
          if (!baseline || baseline.calendar_id !== calendarId)
            throw new Error('deletion_requires_acknowledged_baseline');
          assertTaskOwner(event, baseline.task_id);
          if (!sameEvent(eventBaseline(event), baseline.baseline))
            throw new Error('deletion_conflict_remote_changed');
          try {
            await deleteCalendarEvent({
              accessToken,
              calendarId,
              eventId: r.event_id,
              ifMatch: event.etag ?? baseline.etag,
              sendUpdates: 'none',
            });
          } catch (error) {
            if (
              !(error instanceof Error) ||
              error.message !== 'google_precondition_failed'
            )
              throw error;
            const latest = await loadEvent(accessToken, calendarId, r.event_id);
            if (latest && latest.status !== 'cancelled')
              throw new Error('deletion_conflict_remote_changed');
          }
        }
        const { error: baselineDeleteError } = await supabase
          .from('task_calendar_deletion_baselines')
          .delete()
          .eq('user_id', r.user_id)
          .eq('event_id', r.event_id);
        if (baselineDeleteError) throw baselineDeleteError;
        const { error: deleteError } = await supabase
          .from('pending_calendar_deletions')
          .delete()
          .eq('id', r.id)
          .eq('user_id', r.user_id);
        if (deleteError) throw deleteError;
        deleted++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'delete_failed';
        await supabase
          .from('pending_calendar_deletions')
          .update({ last_error: msg })
          .eq('id', r.id)
          .eq('user_id', r.user_id);
        failed++;
      }
    }
  }

  return { deleted, failed };
}

export function buildEventInput(
  t: TaskRowForPush,
  timezone = 'UTC',
): GoogleCalendarEventInput | null {
  if (t.time_kind == null) {
    if (
      t.is_completed ||
      t.status === 'done' ||
      t.status === 'archived' ||
      t.parent_id ||
      !legacyGoogleBlock(t)
    )
      return null;
    // Match main's payload: no recurrence/timezone/transparency rewrite for an
    // unknown historical booking. Explicit intent uses the shared projection.
    return {
      summary: t.title || 'Untitled task',
      description: t.notes ?? undefined,
      start: { dateTime: t.start_at! },
      end: { dateTime: t.due_at! },
      extendedProperties: {
        private: { [FIRSTLIGHT_TAG_KEY]: t.id, source: 'first-light' },
      },
    };
  }
  const projection = projectTaskCalendar(t, timezone);
  if (!projection) {
    if (
      !t.is_completed &&
      t.status !== 'done' &&
      t.status !== 'archived' &&
      !t.parent_id &&
      taskTimeKind(t) === 'work'
    ) {
      throw new Error(
        'Invalid work interval; review before removing its calendar event.',
      );
    }
    return null;
  }
  const zone = validTimezone(t.schedule_timezone ?? timezone);
  return {
    summary: t.title || 'Untitled task',
    description: taskCalendarDescription(t.notes, projection, zone) ?? '',
    start:
      'date' in projection.start
        ? { ...projection.start, dateTime: null, timeZone: null }
        : { ...projection.start, date: null, timeZone: zone },
    end:
      'date' in projection.end
        ? { ...projection.end, dateTime: null, timeZone: null }
        : { ...projection.end, date: null, timeZone: zone },
    transparency: projection.transparency,
    recurrence: projection.recurrence ? [`RRULE:${projection.recurrence}`] : [],
    extendedProperties: {
      private: { [FIRSTLIGHT_TAG_KEY]: t.id, source: 'first-light' },
    },
  };
}
