"use client";

import { CalendarDays, MapPin, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "@/lib/db.types";
import type { LanguageCode } from "@/lib/i18n";
import { DateTimePicker } from "./date-time-picker";

/**
 * Shared edit dialog for a Google Calendar event.
 *
 * Used by both the calendar-page chip (CalendarEventChip) and the today-list
 * row (EventTaskRow) so the editing experience is identical no matter where
 * the user clicks.
 *
 * Round F v4.2 changes vs the prior dialog embedded in calendar-event-chip:
 *   - Visual styling tightened to match First Light's native task-detail
 *     pane: same border radius, same input padding, same bg-muted shade.
 *   - Gap-preserving start/due logic: when the user edits start past end,
 *     end auto-shifts forward by the SAME duration, keeping the event the
 *     same length. When end is dragged before start, start pulls back the
 *     same gap. Mirrors the native task editor where adjusting one date
 *     moves the other so start ≤ end is always preserved.
 *   - Side-by-side Start/End layout on desktop, stacked on mobile.
 *   - Footer "Open in Google Calendar" link rendered as a small text
 *     button below action buttons rather than competing for footer width.
 */
type RawEvent = {
  recurringEventId?: string;
  attendees?: Array<{
    email?: string;
    displayName?: string;
    responseStatus?: "needsAction" | "declined" | "tentative" | "accepted";
    organizer?: boolean;
    self?: boolean;
  }>;
};

export function EventEditDialog({
  event,
  onClose,
}: {
  event: CalendarEvent;
  lang?: LanguageCode | string;
  onClose: () => void;
}) {
  const allDay = !!event.is_all_day;
  const initialTitle = event.title ?? "";
  const initialStart = event.start_at ?? "";
  const initialEnd = event.end_at ?? "";

  const raw = (event.raw ?? {}) as RawEvent;
  const isRecurringInstance = !!raw.recurringEventId;
  const initialAttendees = (raw.attendees ?? [])
    .map((a) => (a.email ?? "").trim())
    .filter((e) => e.length > 0);

  const [title, setTitle] = useState(initialTitle);
  const [startVal, setStartVal] = useState(initialStart);
  const [endVal, setEndVal] = useState(initialEnd);
  const [attendees, setAttendees] = useState<string[]>(initialAttendees);
  const [newAttendee, setNewAttendee] = useState("");
  const [scope, setScope] = useState<"instance" | "series">("instance");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Gap-preserving start handler: if the new start lands AFTER the current
  // end, push end forward by the same amount the start moved so the event
  // duration stays constant. Mirrors how First Light's native task editor
  // shifts the partner date when one crosses the other.
  function changeStart(nextIso: string | null) {
    const next = nextIso ?? "";
    const prev = startVal ? new Date(startVal) : null;
    setStartVal(next);
    if (!next || !prev) return;
    const newStart = new Date(next);
    const curEnd = endVal ? new Date(endVal) : null;
    if (!curEnd || Number.isNaN(curEnd.getTime())) return;
    if (newStart.getTime() > curEnd.getTime()) {
      const delta = newStart.getTime() - prev.getTime();
      const adjustedEnd = new Date(curEnd.getTime() + delta);
      setEndVal(adjustedEnd.toISOString());
    }
  }

  function changeEnd(nextIso: string | null) {
    const next = nextIso ?? "";
    const prev = endVal ? new Date(endVal) : null;
    setEndVal(next);
    if (!next || !prev) return;
    const newEnd = new Date(next);
    const curStart = startVal ? new Date(startVal) : null;
    if (!curStart || Number.isNaN(curStart.getTime())) return;
    if (newEnd.getTime() < curStart.getTime()) {
      const delta = newEnd.getTime() - prev.getTime();
      const adjustedStart = new Date(curStart.getTime() + delta);
      setStartVal(adjustedStart.toISOString());
    }
  }

  const attendeesSame =
    attendees.length === initialAttendees.length &&
    attendees.every((a, i) => a === initialAttendees[i]);

  const dirty =
    title !== initialTitle ||
    startVal !== initialStart ||
    endVal !== initialEnd ||
    !attendeesSame;

  function addAttendee() {
    const e = newAttendee.trim();
    if (!e || !e.includes("@")) return;
    if (attendees.includes(e)) {
      setNewAttendee("");
      return;
    }
    setAttendees([...attendees, e]);
    setNewAttendee("");
  }

  function removeAttendee(email: string) {
    setAttendees(attendees.filter((a) => a !== email));
  }

  async function handleSave() {
    setBusy(true);
    setError(null);
    try {
      const patch: Record<string, unknown> = {};
      if (title !== initialTitle) patch.title = title;
      if (startVal !== initialStart) patch.start_at = startVal || null;
      if (endVal !== initialEnd) patch.end_at = endVal || null;
      if (!attendeesSame) patch.attendees = attendees;
      if (Object.keys(patch).length === 0) {
        onClose();
        return;
      }
      const params = new URLSearchParams();
      if (isRecurringInstance) params.set("scope", scope);
      const res = await fetch(
        `/api/calendar/google/event/${encodeURIComponent(event.id)}?${params.toString()}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(patch),
        }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `http_${res.status}`);
      }
      if (typeof window !== "undefined") window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "save_failed");
      setBusy(false);
    }
  }

  async function handleDelete() {
    const msg =
      isRecurringInstance && scope === "series"
        ? "Delete the entire recurring series from Google Calendar?"
        : "Delete this event from Google Calendar?";
    if (typeof window !== "undefined" && !window.confirm(msg)) return;
    setBusy(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (isRecurringInstance) params.set("scope", scope);
      const res = await fetch(
        `/api/calendar/google/event/${encodeURIComponent(event.id)}?${params.toString()}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `http_${res.status}`);
      }
      if (typeof window !== "undefined") window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "delete_failed");
      setBusy(false);
    }
  }

  function openInGoogle() {
    if (event.html_link && typeof window !== "undefined") {
      window.open(event.html_link, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-3 sm:p-4 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-bg border border-border rounded-lg shadow-xl w-full max-w-md p-4 sm:p-5 max-h-[92vh] overflow-visible"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 text-xs text-muted-fg mb-1 uppercase tracking-wider">
              <CalendarDays className="size-3" />
              Google Calendar event
            </p>
            <h2 className="text-lg font-semibold leading-tight">Edit event</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-fg hover:text-fg shrink-0 size-7 grid place-items-center rounded hover:bg-muted"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Scope radio for recurring events */}
        {isRecurringInstance && (
          <div className="mb-4 p-3 rounded border border-amber-200 bg-amber-50/40 text-amber-900">
            <div className="text-xs font-medium uppercase tracking-wider mb-2">
              Apply changes to
            </div>
            <label className="flex items-center gap-2 text-sm mb-1 cursor-pointer">
              <input
                type="radio"
                name="scope"
                value="instance"
                checked={scope === "instance"}
                onChange={() => setScope("instance")}
              />
              This event only
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="scope"
                value="series"
                checked={scope === "series"}
                onChange={() => setScope("series")}
              />
              All events in the series
            </label>
          </div>
        )}

        <label className="block mb-4">
          <span className="block text-xs uppercase tracking-wider text-muted-fg mb-1">
            Title
          </span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-border rounded-md px-3 py-2 text-sm bg-bg outline-none focus:border-fg/40"
            autoFocus
          />
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <label className="block">
            <span className="block text-xs uppercase tracking-wider text-muted-fg mb-1">
              Starts
            </span>
            <DateTimePicker
              value={startVal || null}
              onChange={(iso) => changeStart(iso)}
              className="w-full"
              placeholder="Pick a start"
            />
          </label>
          <label className="block">
            <span className="block text-xs uppercase tracking-wider text-muted-fg mb-1">
              Ends
            </span>
            <DateTimePicker
              value={endVal || null}
              onChange={(iso) => changeEnd(iso)}
              className="w-full"
              placeholder="Pick an end"
            />
          </label>
        </div>

        {event.location && (
          <div className="text-sm text-muted-fg mb-4 flex items-center gap-1.5">
            <MapPin className="size-3.5" />
            <span className="truncate">{event.location}</span>
          </div>
        )}

        {/* Attendees */}
        <div className="mb-4">
          <div className="block text-xs uppercase tracking-wider text-muted-fg mb-1">
            Attendees
          </div>
          {attendees.length > 0 ? (
            <ul className="mb-2 flex flex-wrap gap-1.5">
              {attendees.map((a) => {
                const status = (raw.attendees ?? []).find(
                  (x) => x.email === a
                )?.responseStatus;
                return (
                  <li
                    key={a}
                    className={cn(
                      "inline-flex items-center gap-1 px-2 py-1 rounded text-sm",
                      "bg-muted/60 border border-border/60"
                    )}
                    title={status ? `${a} — ${status}` : a}
                  >
                    <span>{a}</span>
                    {status === "accepted" && (
                      <span className="text-green-600 text-[11px]">✓</span>
                    )}
                    {status === "declined" && (
                      <span className="text-red-500 text-[11px]">✗</span>
                    )}
                    {status === "tentative" && (
                      <span className="text-amber-600 text-[11px]">?</span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeAttendee(a)}
                      className="ml-0.5 text-muted-fg hover:text-fg"
                      aria-label={`Remove ${a}`}
                    >
                      <X className="size-3" />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="text-sm text-muted-fg mb-2 italic">
              No attendees yet.
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="name@example.com"
              value={newAttendee}
              onChange={(e) => setNewAttendee(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addAttendee();
                }
              }}
              className="flex-1 min-w-0 border border-border rounded-md px-2 py-1.5 text-sm bg-bg outline-none focus:border-fg/40"
            />
            <button
              type="button"
              onClick={addAttendee}
              disabled={!newAttendee.includes("@")}
              className="text-sm px-3 py-1.5 rounded-md border border-border hover:bg-muted disabled:opacity-40 shrink-0"
            >
              Add
            </button>
          </div>
        </div>

        {error && (
          <div className="text-sm text-red-600 mb-3">Error: {error}</div>
        )}

        {/* Footer — actions wrap onto multiple rows on narrow viewports. */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border">
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            className="text-sm px-3 py-1.5 rounded-md border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Delete
          </button>
          <div className="flex flex-wrap items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="text-sm px-3 py-1.5 rounded-md hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={busy || !dirty}
              className="text-sm px-3 py-1.5 rounded-md bg-fg text-bg hover:opacity-90 disabled:opacity-40"
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        {event.html_link && (
          <div className="pt-3 text-center">
            <button
              type="button"
              onClick={openInGoogle}
              className="text-xs text-muted-fg hover:text-fg underline underline-offset-2"
            >
              Open in Google Calendar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function toInputValue(iso: string | null, allDay: boolean): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  if (allDay) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

function fromInputValue(value: string, allDay: boolean): string {
  if (allDay) return value;
  return new Date(value).toISOString();
}

function parseInputDate(value: string, allDay: boolean): Date | null {
  if (!value) return null;
  const d = allDay ? new Date(`${value}T00:00:00`) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
