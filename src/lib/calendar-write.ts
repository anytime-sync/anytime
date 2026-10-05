/** Task → Google sync uses the same calendar projection as the ICS feed.
 * New tasks and dirty linked tasks are retried across downtime. Existing rows
 * are not marked dirty by the migration; historical repair needs review. */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getValidAccessToken } from "./calendar-token";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  patchCalendarEvent,
  type GoogleCalendarEventInput,
} from "./google-calendar";

import { createHash } from "node:crypto";
import { projectTaskCalendar, taskCalendarDescription, validTimezone } from "./task-calendar";
import type { TaskTimeKind } from "./task-schedule";

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
  updated_at: string | null;
};

export function isOurOwnEventTag(privateProps?: Record<string, string>): string | null {
  if (!privateProps) return null;
  const id = privateProps[FIRSTLIGHT_TAG_KEY];
  return typeof id === "string" && id.length > 0 ? id : null;
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
      if (!event) {
        if (eventId) await deleteCalendarEvent({ accessToken, calendarId: primaryCalendarId, eventId });
        eventId = null;
      } else if (eventId) {
        const result = await patchCalendarEvent({ accessToken, calendarId: primaryCalendarId, eventId, patch: event, sendUpdates: 'none' });
        if (result.status === 'cancelled') throw new Error('Linked calendar event is missing; review its source before recreating.');
      } else {
        // Google ids permit lowercase base32hex. A stable task-derived id makes
        // retries idempotent if the event succeeds but saving its link fails.
        eventId = `fl${createHash('sha256').update(t.id).digest('hex')}`;
        try { await createCalendarEvent({ accessToken, calendarId: primaryCalendarId, event: { ...event, id: eventId }, sendUpdates: 'none' }); }
        catch (error) {
          if (!(error instanceof Error) || !/^google_create_event_failed: 409\b/.test(error.message)) throw error;
          const result = await patchCalendarEvent({ accessToken, calendarId: primaryCalendarId, eventId, patch: event, sendUpdates: 'none' });
          if (result.status === 'cancelled') throw new Error('Task calendar event could not be recovered.');
        }
      }
      const { data: saved, error } = await supabase.from('tasks')
        .update({ calendar_event_id: eventId, calendar_dirty: false })
        .eq('user_id', userId).eq('id', t.id).eq('updated_at', t.updated_at)
        .select('id');
      if (error) throw error;
      if (!saved?.length) throw new Error('Task changed during sync; retry pending.');
      if (event) { if (t.calendar_event_id) patched++; else created++; }
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
        await deleteCalendarEvent({
          accessToken,
          calendarId,
          eventId: r.event_id,
        });
        await supabase
          .from("pending_calendar_deletions")
          .delete()
          .eq("id", r.id);
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
  if (!projection) return null;
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
