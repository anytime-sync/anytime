/**
 * calendar-write.ts — Round F v2: push tasks → Google Calendar events.
 *
 * Used by the cron's write pass (src/app/api/cron/calendar-sync/route.ts).
 *
 * Sync model:
 *   - Only tasks with start_at AND due_at sync.
 *   - Created events carry extendedProperties.private.firstlightTaskId so
 *     the read-side cron can identify and skip them (no double-create).
 *   - On update, PATCH the existing event if tasks.calendar_event_id is
 *     set; otherwise POST and persist the returned id.
 *   - On delete, the AFTER DELETE trigger on `tasks` writes to
 *     `pending_calendar_deletions`; the cron drains that queue.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getValidAccessToken } from "./calendar-token";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  patchCalendarEvent,
  type GoogleCalendarEventInput,
} from "./google-calendar";

const FIRSTLIGHT_TAG_KEY = "firstlightTaskId";

export type TaskRowForPush = {
  id: string;
  user_id: string;
  title: string;
  notes: string | null;
  start_at: string;
  due_at: string;
  is_all_day: boolean | null;
  calendar_event_id: string | null;
  updated_at: string | null;
};

export function isOurOwnEventTag(privateProps?: Record<string, string>): string | null {
  if (!privateProps) return null;
  const id = privateProps[FIRSTLIGHT_TAG_KEY];
  return typeof id === "string" && id.length > 0 ? id : null;
}

/**
 * Push pass for one user. Caller must have already established the
 * user is connected to Google. Returns count of (created, patched).
 *
 * Selects tasks that:
 *   - belong to this user
 *   - have both start_at and due_at
 *   - either have no calendar_event_id (need create), or
 *     updated_at is newer than the cron's last_sync_at proxy (need patch)
 *
 * To keep it cheap we cap the per-user batch at 50. The next tick picks
 * up the rest.
 */
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
}): Promise<{ created: number; patched: number; failed: number }> {
  // Tasks needing CREATE: no calendar_event_id, has both timestamps.
  const { data: needCreateRaw } = await supabase
    .from("tasks")
    .select("id, user_id, title, notes, start_at, due_at, is_all_day, calendar_event_id, updated_at")
    .eq("user_id", userId)
    .is("calendar_event_id", null)
    .not("start_at", "is", null)
    .not("due_at", "is", null)
    .order("updated_at", { ascending: false })
    .limit(25);

  // Tasks needing PATCH: have calendar_event_id, updated in last 10 min.
  // (Crude heuristic: re-PATCH everything touched recently. Cheap enough
  // for v0.1 — can switch to a calendar_pushed_at column later.)
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: needPatchRaw } = await supabase
    .from("tasks")
    .select("id, user_id, title, notes, start_at, due_at, is_all_day, calendar_event_id, updated_at")
    .eq("user_id", userId)
    .not("calendar_event_id", "is", null)
    .not("start_at", "is", null)
    .not("due_at", "is", null)
    .gte("updated_at", tenMinAgo)
    .order("updated_at", { ascending: false })
    .limit(25);

  const needCreate = (needCreateRaw ?? []) as TaskRowForPush[];
  const needPatch = (needPatchRaw ?? []) as TaskRowForPush[];

  let created = 0;
  let patched = 0;
  let failed = 0;

  for (const t of needCreate) {
    try {
      const ev = await createCalendarEvent({
        accessToken,
        calendarId: primaryCalendarId,
        event: buildEventInput(t),
      });
      await supabase
        .from("tasks")
        .update({ calendar_event_id: ev.id })
        .eq("id", t.id);
      created++;
    } catch (e) {
      console.error("[calendar-write] create failed", t.id, e);
      failed++;
    }
  }

  for (const t of needPatch) {
    if (!t.calendar_event_id) continue;
    try {
      await patchCalendarEvent({
        accessToken,
        calendarId: primaryCalendarId,
        eventId: t.calendar_event_id,
        patch: buildEventInput(t),
      });
      patched++;
    } catch (e) {
      console.error("[calendar-write] patch failed", t.id, e);
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

function buildEventInput(t: TaskRowForPush): GoogleCalendarEventInput {
  const isAllDay = Boolean(t.is_all_day);
  const summary = t.title || "Untitled task";
  const description = t.notes ?? undefined;

  const start = isAllDay
    ? { date: t.start_at.slice(0, 10) }
    : { dateTime: t.start_at };
  const end = isAllDay
    ? { date: t.due_at.slice(0, 10) }
    : { dateTime: t.due_at };

  return {
    summary,
    description,
    start,
    end,
    extendedProperties: {
      private: {
        [FIRSTLIGHT_TAG_KEY]: t.id,
        source: "first-light",
      },
    },
  };
}
