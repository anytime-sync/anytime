"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { calendarConflictMessage } from "@/lib/calendar-conflict-message";
import type { reviewCalendarTask } from "@/lib/calendar-review";
type Review = Awaited<ReturnType<typeof reviewCalendarTask>>["result"];
type Item = {
  id: string;
  title: string;
  calendar_conflict: { reason: string } | null;
  calendar_event_id: string | null;
};
async function request(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Unable to load calendar review.");
  return data;
}
export function CalendarSyncReview() {
  const qc = useQueryClient();
  const issues = useQuery<{ items: Item[]; truncated: boolean }>({
    queryKey: ["calendarSyncIssues"],
    queryFn: () => request("/api/calendar/google/review"),
  });
  const [review, setReview] = useState<Review | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function inspect(id: string) {
    setBusy(true);
    setReview(null);
    setError("");
    try {
      setReview(
        await request(
          `/api/calendar/google/review?taskId=${encodeURIComponent(id)}`,
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function accept() {
    if (!review) return;
    setBusy(true);
    setError("");
    try {
      await request("/api/calendar/google/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: review.taskId,
          review: review.review,
          choice: "calendar",
        }),
      });
      setReview(null);
    } catch (e) {
      setError((e as Error).message);
      setReview(null);
    } finally {
      setBusy(false);
      for (const key of [
        "calendarSyncIssues",
        "calendarEvents",
        "tasks",
        "task",
        "subtasks",
        "subtaskCounts",
        "upcoming-reminders",
      ])
        void qc.invalidateQueries({ queryKey: [key] });
    }
  }
  return (
    <div className="space-y-3 border-t border-border pt-3">
      <h3 className="font-medium">Pending calendar changes</h3>
      {issues.isPending && <p role="status">Loading…</p>}
      {issues.error && (
        <p role="alert">
          Unable to load pending changes.{" "}
          <button onClick={() => void issues.refetch()}>Try again</button>
        </p>
      )}
      {issues.data?.items.length === 0 && (
        <p className="text-sm text-muted-fg">No pending task changes.</p>
      )}
      <ul className="space-y-3">
        {issues.data?.items.map((item) => (
          <li key={item.id}>
            <p>{item.title}</p>
            <p className="text-sm text-muted-fg">
              {item.calendar_conflict
                ? calendarConflictMessage(item.calendar_conflict.reason)
                : "Waiting to sync. Use Sync now to retry."}
            </p>
            {item.calendar_conflict && item.calendar_event_id && (
              <button
                className="btn-ghost"
                disabled={busy}
                onClick={() => void inspect(item.id)}
              >
                Review versions
              </button>
            )}
          </li>
        ))}
      </ul>
      {issues.data?.truncated && <p>Showing the latest 100 pending tasks.</p>}
      {error && <p role="alert">{error}</p>}
      {review && (
        <div
          role="region"
          aria-label="Review calendar conflict"
          className="border border-border rounded p-3 space-y-3"
        >
          <p>Account timezone: {review.timezone}</p>
          {(
            [
              ["First Light", review.local],
              ["Google Calendar", review.remote],
            ] as const
          ).map(([name, version]) => (
            <div key={name}>
              <h4 className="font-medium">{name}</h4>
              <p>{version?.title ?? "Event deleted or unavailable"}</p>
              <p className="whitespace-pre-wrap">{version?.notes}</p>
              <p>{version?.when}</p>
            </div>
          ))}
          {review.canAcceptCalendar ? (
            <>
              <p>
                Use this Google version for the same task’s supported title,
                notes and schedule. Its task identity stays the same.
              </p>
              <button
                className="btn-primary"
                disabled={busy}
                onClick={() => void accept()}
              >
                Use reviewed Google version
              </button>
            </>
          ) : (
            <p>
              {calendarConflictMessage(review.limitation ?? "")} This change
              cannot be resolved here. Keep the native task and review it in
              Tasks and Google Calendar.
            </p>
          )}
          <p className="text-sm text-muted-fg">
            To retain First Light’s version, leave this conflict open and
            reconcile the event in Google Calendar, then sync and review again.
            This screen does not overwrite or recreate Google events.
          </p>
          <button
            className="btn-ghost"
            disabled={busy}
            onClick={() => setReview(null)}
          >
            Close without changes
          </button>
        </div>
      )}
    </div>
  );
}
