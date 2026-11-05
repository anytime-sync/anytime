import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getValidAccessToken } from "./calendar-token";
import {
  buildEventInput,
  loadEvent,
  type TaskRowForPush,
} from "./calendar-write";
import {
  CalendarConflict,
  eventBaseline,
  inboundTaskPatch,
  verifyMirror,
} from "./calendar-reconcile";
import { accountTimezone } from "./task-channel";
import { taskNotificationDate } from "./task-notification";

export class CalendarReviewError extends Error {
  constructor(
    message: string,
    public status = 409,
  ) {
    super(message);
  }
}

/** Owner-only review. A shared task editor's access to a task is not access to
 * the owner's provider connection. No remote snapshot is stored on the task. */
export async function reviewCalendarTask(
  db: SupabaseClient,
  userId: string,
  taskId: string,
) {
  const { data, error } = await db
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .eq("id", taskId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new CalendarReviewError("Task not found.", 404);
  const task = data as TaskRowForPush;
  const zone = await accountTimezone(db, userId);
  const { data: connection, error: connError } = await db
    .from("user_calendar_connections")
    .select("primary_calendar_id")
    .eq("user_id", userId)
    .eq("provider", "google")
    .maybeSingle();
  if (connError) throw connError;
  const calendarId = connection?.primary_calendar_id;
  if (!calendarId || !task.calendar_event_id)
    throw new CalendarReviewError(
      "This task has no active calendar link. Sync again to check pending work.",
    );
  const token = await getValidAccessToken({ supabase: db, userId });
  if (!token) throw new CalendarReviewError("Calendar connection unavailable.");
  const event = await loadEvent(token, calendarId, task.calendar_event_id);
  let patch: Record<string, unknown> | null = null;
  let limitation: string | null = null;
  try {
    if (!event || event.status === "cancelled")
      throw new CalendarConflict("remote_deleted_task_retained");
    verifyMirror(task, event, calendarId);
    if (
      task.rrule ||
      event.recurringEventId ||
      event.recurrence?.length ||
      task.calendar_conflict?.reason ===
        "recurring_occurrence_edit_requires_review"
    )
      throw new CalendarConflict("recurring_occurrence_edit_requires_review");
    if (
      !task.time_kind ||
      !task.calendar_baseline ||
      !task.calendar_etag ||
      !event.etag
    )
      throw new CalendarConflict("missing_acknowledged_baseline");
    if (
      task.is_completed ||
      task.status === "done" ||
      task.status === "archived" ||
      task.parent_id
    )
      throw new CalendarConflict("inactive_task_requires_review");
    // Validate the remote change against the acknowledged contract, then
    // compare with the current local projection: explicit acceptance must also
    // undo supported local-only differences, not acknowledge a mixed version.
    inboundTaskPatch(task, event, task.calendar_baseline, zone);
    let local;
    try {
      local = buildEventInput(task, zone);
    } catch {
      throw new CalendarConflict("legacy_or_changed_time_intent");
    }
    if (!local) throw new CalendarConflict("inactive_task_requires_review");
    patch = inboundTaskPatch(task, event, eventBaseline(local), zone);
  } catch (e) {
    if (!(e instanceof CalendarConflict)) throw e;
    limitation = e.reason;
  }
  const projection =
    event && event.status !== "cancelled" ? eventBaseline(event) : null;
  const review = createHash("sha256")
    .update(
      JSON.stringify([
        task.updated_at,
        task.calendar_event_id,
        task.calendar_etag,
        task.calendar_baseline,
        task.calendar_conflict,
        // Exact task revision already binds its native fields. Unsupported
        // historical schedules must remain reviewable without projecting them.
        zone,
        event?.etag,
        projection,
      ]),
    )
    .digest("hex");
  const result = {
    taskId,
    revision: task.updated_at,
    review,
    canAcceptCalendar: !!patch,
    limitation,
    local: {
      title: task.title,
      notes: task.notes,
      when: taskNotificationDate(task, zone),
    },
    remote: projection
      ? {
          title: projection.summary,
          notes: projection.description,
          when: patch
            ? taskNotificationDate({ ...task, ...patch }, zone)
            : "Schedule change requires manual review.",
        }
      : null,
    timezone: zone,
  };
  return { result, task, event, calendarId, patch };
}

/** Accept only the exact reviewed supported remote revision. No provider write,
 * completion, deletion, recreation or identity change is performed. A remote
 * edit after this read remains a later revision for the next inbound sync. */
export async function acceptCalendarReview(
  db: SupabaseClient,
  userId: string,
  taskId: string,
  review: string,
) {
  const current = await reviewCalendarTask(db, userId, taskId);
  if (current.result.review !== review)
    throw new CalendarReviewError(
      "Either version changed. Refresh and review both versions again.",
    );
  if (!current.patch || !current.event?.etag)
    throw new CalendarReviewError(
      "This change needs manual review. Your native task is retained.",
    );
  const { task, event, calendarId, patch } = current;
  const { data, error } = await db.rpc("reconcile_task_calendar", {
    p_user_id: userId,
    p_task_id: taskId,
    p_expected_updated_at: task.updated_at,
    p_calendar_id: calendarId,
    p_event_id: event.id,
    p_etag: event.etag,
    p_baseline: eventBaseline(event),
    p_patch: patch,
  });
  if (error) throw error;
  if (!data)
    throw new CalendarReviewError(
      "The task changed. Refresh and review again.",
    );
  return { ok: true };
}
