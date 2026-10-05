/** Task → Google sync uses the same calendar projection as the ICS feed.
 * New tasks and dirty linked tasks are retried across downtime. Existing rows
 * are not marked dirty by the migration; historical repair needs review. */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getValidAccessToken } from "./calendar-token";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  getCalendarEvent,
  patchCalendarEvent,
  type GoogleCalendarEvent,
  type GoogleCalendarEventInput,
} from "./google-calendar";

import { createHash } from "node:crypto";
import { projectTaskCalendar, taskCalendarDescription, validTimezone } from "./task-calendar";
import { taskTimeKind, type TaskTimeKind } from "./task-schedule";

const FIRSTLIGHT_TAG_KEY = "firstlightTaskId";

export type TaskRowForPush = {
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

export function isOurOwnEventTag(privateProps?: Record<string, string>): string | null {
  if (!privateProps) return null;
  const id = privateProps[FIRSTLIGHT_TAG_KEY];
  return typeof id === "string" && id.length > 0 ? id : null;
}

function taskEventId(taskId: string, generation: number): string {
  // Preserve generation-zero identity from the initial implementation.
  return `fl${createHash('sha256').update(generation ? `${taskId}:${generation}` : taskId).digest('hex')}`;
}

async function loadEvent(accessToken: string, calendarId: string, eventId: string): Promise<GoogleCalendarEvent | null> {
  try { return await getCalendarEvent({ accessToken, calendarId, eventId }); }
  catch (error) {
    if (error instanceof Error && /^google_get_event_failed: 404\b/.test(error.message)) return null;
    if (error instanceof Error && /^google_get_event_failed: 410\b/.test(error.message)) return { id: eventId, status: 'cancelled' };
    throw error;
  }
}

function assertTaskOwner(event: GoogleCalendarEvent, taskId?: string) {
  const owner = isOurOwnEventTag(event.extendedProperties?.private);
  if (!owner || (taskId && owner !== taskId)) throw new Error('Calendar event ownership is unverified; review before changing it.');
}

async function createTaskEvent(accessToken: string, calendarId: string, task: TaskRowForPush, event: GoogleCalendarEventInput, generation: number) {
  // Deletions leave tombstones, so never restore a cancelled resource. A new
  // persisted generation is stable for retries and distinct on reopening.
  for (let i = 0; i < 8; i++, generation++) {
    const eventId = taskEventId(task.id, generation);
    try {
      await createCalendarEvent({ accessToken, calendarId, event: { ...event, id: eventId }, sendUpdates: 'none' });
      return { eventId, generation };
    } catch (error) {
      if (!(error instanceof Error) || !/^google_create_event_failed: 409\b/.test(error.message)) throw error;
      const existing = await loadEvent(accessToken, calendarId, eventId);
      if (!existing) throw new Error('Conflicting task calendar event is unavailable; retry pending.');
      if (existing.status === 'cancelled') continue;
      assertTaskOwner(existing, task.id);
      const result = await patchCalendarEvent({ accessToken, calendarId, eventId, patch: event, sendUpdates: 'none' });
      if (result.status === 'cancelled') throw new Error('Task calendar event disappeared during recovery; retry pending.');
      return { eventId, generation };
    }
  }
  throw new Error('Repeated calendar tombstones need review; task remains pending.');
}

/** Push at most 50 tasks. Dirty state is cleared only for the exact task
 * version sent, so an edit during a network request remains pending. */
export async function pushPendingTasksForUser({ supabase, userId, primaryCalendarId, accessToken }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>;
  userId: string;
  primaryCalendarId: string;
  accessToken: string;
}): Promise<{ created: number; patched: number; failed: number }> {
  const { data: prefs, error: prefsError } = await supabase.from('user_preferences').select('timezone').eq('user_id', userId).maybeSingle();
  if (prefsError) throw prefsError;
  const timezone = validTimezone(prefs?.timezone ?? 'UTC');
  const { data: needCreateRaw, error: createError } = await supabase.from('tasks').select('*')
    .eq('user_id', userId).is('calendar_event_id', null).eq('calendar_dirty', true).is('parent_id', null)
    .eq('is_completed', false).neq('status', 'done').neq('status', 'archived')
    .or('start_at.not.is.null,due_at.not.is.null')
    .order('updated_at', { ascending: true }).limit(25);
  const { data: needPatchRaw, error: patchError } = await supabase.from('tasks').select('*')
    .eq('user_id', userId).not('calendar_event_id', 'is', null).eq('calendar_dirty', true)
    .order('updated_at', { ascending: true }).limit(25);
  if (createError || patchError) throw createError ?? patchError;
  let created = 0, patched = 0, failed = 0;
  for (const t of [...(needCreateRaw ?? []), ...(needPatchRaw ?? [])] as TaskRowForPush[]) {
    try {
      const event = buildEventInput(t, timezone);
      let eventId = t.calendar_event_id;
      let generation = t.calendar_event_generation ?? 0;
      let didCreate = false;
      const linked = eventId ? await loadEvent(accessToken, primaryCalendarId, eventId) : null;
      if (!event) {
        if (linked && linked.status !== 'cancelled') {
          assertTaskOwner(linked, t.id);
          await deleteCalendarEvent({ accessToken, calendarId: primaryCalendarId, eventId: eventId!, sendUpdates: 'none' });
        }
        if (eventId) generation++;
        eventId = null;
      } else if (eventId && linked?.status !== 'cancelled') {
        if (!linked) throw new Error('Linked calendar event is missing; review its source before recreating.');
        assertTaskOwner(linked, t.id);
        const result = await patchCalendarEvent({ accessToken, calendarId: primaryCalendarId, eventId, patch: event, sendUpdates: 'none' });
        if (result.status === 'cancelled') throw new Error('Linked calendar event is missing; review its source before recreating.');
      } else {
        if (eventId) {
          // A concurrent reopen can happen after Google deletion but before
          // the removal acknowledgement. Only replace a provably generated id.
          if (eventId !== taskEventId(t.id, generation) && isOurOwnEventTag(linked?.extendedProperties?.private) !== t.id) {
            throw new Error('Cancelled linked event ownership is unverified; review before recreating.');
          }
          generation++;
        }
        const createdEvent = await createTaskEvent(accessToken, primaryCalendarId, t, event, generation);
        eventId = createdEvent.eventId;
        generation = createdEvent.generation;
        didCreate = true;
      }
      const { data: saved, error } = await supabase.from('tasks')
        .update({ calendar_event_id: eventId, calendar_event_generation: generation, calendar_dirty: false })
        .eq('user_id', userId).eq('id', t.id).eq('updated_at', t.updated_at)
        .select('id');
      if (error) throw error;
      if (!saved?.length) throw new Error('Task changed during sync; retry pending.');
      if (event) { if (didCreate) created++; else patched++; }
    } catch (error) {
      console.error('[calendar-write] task push failed', t.id, error);
      failed++;
    }
  }
  return { created, patched, failed };
}

/**
 * Drain pending_calendar_deletions. Runs after the per-user push pass
 * inside the cron loop. Uses the claim_pending_calendar_deletions RPC
 * for FOR UPDATE SKIP LOCKED semantics so multiple cron instances
 * don't double-delete.
 */
export async function drainCalendarDeletions({
  supabase,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>;
}): Promise<{ deleted: number; failed: number }> {
  const { data: claimedRaw, error } = await supabase.rpc(
    "claim_pending_calendar_deletions",
    { batch_size: 50 }
  );
  if (error) {
    console.error("[calendar-write] claim queue failed", error);
    return { deleted: 0, failed: 0 };
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
      console.error("[calendar-write] token refresh failed for user", userId, e);
      // Mark these rows with a last_error but leave them; next tick retries.
      for (const r of rows) {
        await supabase
          .from("pending_calendar_deletions")
          .update({ last_error: "token_refresh_failed" })
          .eq("id", r.id);
        failed++;
      }
      continue;
    }
    if (!accessToken) {
      failed += rows.length;
      continue;
    }

    for (const r of rows) {
      const calendarId = r.calendar_id ?? "primary";
      try {
        const event = await loadEvent(accessToken, calendarId, r.event_id);
        if (event && event.status !== 'cancelled') {
          assertTaskOwner(event);
          await deleteCalendarEvent({ accessToken, calendarId, eventId: r.event_id, sendUpdates: 'none' });
        }
        const { error: deleteError } = await supabase
          .from("pending_calendar_deletions")
          .delete()
          .eq("id", r.id);
        if (deleteError) throw deleteError;
        deleted++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "delete_failed";
        await supabase
          .from("pending_calendar_deletions")
          .update({ last_error: msg })
          .eq("id", r.id);
        failed++;
      }
    }
  }

  return { deleted, failed };
}

export function buildEventInput(t: TaskRowForPush, timezone = 'UTC'): GoogleCalendarEventInput | null {
  const projection = projectTaskCalendar(t, timezone);
  if (!projection) {
    if (!t.is_completed && t.status !== 'done' && t.status !== 'archived' && !t.parent_id && taskTimeKind(t) === 'work') {
      throw new Error('Invalid work interval; review before removing its calendar event.');
    }
    return null;
  }
  const zone = validTimezone(timezone);
  return {
    summary: t.title || 'Untitled task',
    description: taskCalendarDescription(t.notes, projection, zone) ?? '',
    start: 'date' in projection.start ? { ...projection.start, dateTime: null, timeZone: null } : { ...projection.start, date: null, timeZone: zone },
    end: 'date' in projection.end ? { ...projection.end, dateTime: null, timeZone: null } : { ...projection.end, date: null, timeZone: zone },
    transparency: projection.transparency,
    recurrence: projection.recurrence ? [`RRULE:${projection.recurrence}`] : [],
    extendedProperties: { private: { [FIRSTLIGHT_TAG_KEY]: t.id, source: 'first-light' } },
  };
}
