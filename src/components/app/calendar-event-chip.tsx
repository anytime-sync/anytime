"use client";

import { CalendarDays, MapPin, X } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "@/lib/db.types";
import { getLanguage, t as trStrict } from "@/lib/i18n";
import type { LanguageCode } from "@/lib/i18n";

// Loose-typed wrapper so we can use ad-hoc keys for v3/v4 without having to
// extend the StringKey union for every new copy string. All call sites still
// supply an English fallback via `tr(...) || "fallback"`.
const tr = trStrict as (l: LanguageCode | string, k: string) => string;

/**
 * Editorial chip for a Google Calendar event.
 *
 * Round F v3: clicking opens an inline edit dialog (rename / reschedule / delete).
 * Round F v4: dialog now also handles attendees (add/remove emails) and offers
 * "this event only / entire series" scope when the event is a recurring instance.
 *
 * Three sizing variants:
 *   - "default": full chip used in horizontal rows / day cells
 *   - "compact": tighter version for the month grid
 *   - "timeline": absolute-positioned variant for the day timeline
 */
export function CalendarEventChip({
  event,
  lang,
  size = "default",
  className,
  style,
}: {
  event: CalendarEvent;
  lang: LanguageCode | string;
  size?: "default" | "compact" | "timeline";
  className?: string;
  style?: React.CSSProperties;
}) {
  const dfLocale = getLanguage(lang).dateFnsLocale;
  const start = event.start_at ? new Date(event.start_at) : null;
  const end = event.end_at ? new Date(event.end_at) : null;
  const allDay = event.is_all_day;

  const [editing, setEditing] = useState(false);

  const timeLabel = (() => {
    if (allDay) return tr(lang, "view.gcal.chip.allDay");
    if (!start) return "";
    const s = format(start, "h:mm", { locale: dfLocale });
    if (!end) return s;
    return `${s}–${format(end, "h:mm", { locale: dfLocale })}`;
  })();

  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(true);
  };

  const title = event.title?.trim() || tr(lang, "view.gcal.chip.untitled");

  const chip = (() => {
    if (size === "timeline") {
      return (
        <div
          role="button"
          tabIndex={0}
          onClick={onClick}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onClick(e as unknown as React.MouseEvent);
            }
          }}
          title={`${title}${event.location ? " — " + event.location : ""}`}
          style={style}
          className={cn(
            "absolute rounded-md text-left px-2 py-1 pointer-events-auto",
            "bg-muted/60 border border-border text-fg/90",
            "hover:bg-muted hover:border-fg/30 transition-colors",
            "flex flex-col gap-0.5 overflow-hidden cursor-pointer select-none",
            className
          )}
        >
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider tabular-nums text-muted-fg">
            <CalendarDays className="size-3" />
            {timeLabel}
          </span>
          <span className="text-xs font-medium leading-snug truncate">
            {title}
          </span>
          {event.location && (
            <span className="text-[10px] text-muted-fg leading-snug truncate">
              {event.location}
            </span>
          )}
        </div>
      );
    }

    if (size === "compact") {
      return (
        <button
          type="button"
          onClick={onClick}
          title={`${title}${event.location ? " — " + event.location : ""}`}
          className={cn(
            "w-full inline-flex items-center gap-1 px-1.5 h-5 rounded text-[10px]",
            "bg-muted/60 hover:bg-muted text-fg/85",
            "min-w-0 text-left",
            className
          )}
        >
          <CalendarDays className="size-2.5 shrink-0 text-muted-fg" />
          <span className="tabular-nums text-muted-fg shrink-0">{timeLabel}</span>
          <span className="truncate">{title}</span>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={onClick}
        title={`${title}${event.location ? " — " + event.location : ""}`}
        className={cn(
          "inline-flex items-center gap-1.5 px-2 h-7 rounded-md text-xs",
          "bg-muted/60 hover:bg-muted text-fg/90 transition-colors",
          "border border-border/60 hover:border-border",
          "min-w-0 max-w-full",
          className
        )}
      >
        <CalendarDays className="size-3 shrink-0 text-muted-fg" />
        <span className="tabular-nums text-muted-fg shrink-0">{timeLabel}</span>
        <span className="truncate font-medium">{title}</span>
        {event.location && (
          <span className="hidden sm:inline-flex items-center gap-0.5 text-muted-fg shrink-0 max-w-[120px]">
            <MapPin className="size-2.5" />
            <span className="truncate">{event.location}</span>
          </span>
        )}
      </button>
    );
  })();

  return (
    <>
      {chip}
      {editing && (
        <CalendarEventEditDialog
          event={event}
          lang={lang}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Edit dialog — Round F v3 + v4                                      */
/* ------------------------------------------------------------------ */

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

function CalendarEventEditDialog({
  event,
  lang,
  onClose,
}: {
  event: CalendarEvent;
  lang: LanguageCode | string;
  onClose: () => void;
}) {
  const allDay = !!event.is_all_day;
  const initialTitle = event.title ?? "";
  const initialStart = toInputValue(event.start_at, allDay);
  const initialEnd = toInputValue(event.end_at, allDay);

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
      if (startVal !== initialStart) {
        patch.start_at = fromInputValue(startVal, allDay);
      }
      if (endVal !== initialEnd) {
        patch.end_at = fromInputValue(endVal, allDay);
      }
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
      tr(lang, "view.gcal.chip.deleteConfirm") ||
      (isRecurringInstance && scope === "series"
        ? "Delete the entire recurring series from Google Calendar?"
        : "Delete this event from Google Calendar?");
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
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-bg border border-border rounded-lg shadow-xl w-full max-w-md p-5 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {tr(lang, "view.gcal.chip.editTitle") || "Edit calendar event"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-fg hover:text-fg text-sm"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Scope radio for recurring events */}
        {isRecurringInstance && (
          <div className="mb-4 p-3 rounded border border-amber-200 bg-amber-50/40 text-amber-900">
            <div className="text-xs font-medium uppercase tracking-wider mb-2">
              {tr(lang, "view.gcal.chip.scopeLabel") || "Apply changes to"}
            </div>
            <label className="flex items-center gap-2 text-sm mb-1 cursor-pointer">
              <input
                type="radio"
                name="scope"
                value="instance"
                checked={scope === "instance"}
                onChange={() => setScope("instance")}
              />
              {tr(lang, "view.gcal.chip.scopeInstance") ||
                "This event only"}
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="scope"
                value="series"
                checked={scope === "series"}
                onChange={() => setScope("series")}
              />
              {tr(lang, "view.gcal.chip.scopeSeries") ||
                "All events in the series"}
            </label>
          </div>
        )}

        <label className="block mb-3">
          <span className="block text-xs uppercase tracking-wider text-muted-fg mb-1">
            {tr(lang, "view.gcal.chip.titleLabel") || "Title"}
          </span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-border rounded px-3 py-2 bg-bg outline-none focus:border-fg/40"
            autoFocus
          />
        </label>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <label className="block">
            <span className="block text-xs uppercase tracking-wider text-muted-fg mb-1">
              {tr(lang, "view.gcal.chip.startLabel") || "Start"}
            </span>
            <input
              type={allDay ? "date" : "datetime-local"}
              value={startVal}
              onChange={(e) => setStartVal(e.target.value)}
              className="w-full border border-border rounded px-3 py-2 bg-bg outline-none focus:border-fg/40"
            />
          </label>
          <label className="block">
            <span className="block text-xs uppercase tracking-wider text-muted-fg mb-1">
              {tr(lang, "view.gcal.chip.endLabel") || "End"}
            </span>
            <input
              type={allDay ? "date" : "datetime-local"}
              value={endVal}
              onChange={(e) => setEndVal(e.target.value)}
              className="w-full border border-border rounded px-3 py-2 bg-bg outline-none focus:border-fg/40"
            />
          </label>
        </div>

        {event.location && (
          <div className="text-xs text-muted-fg mb-3 flex items-center gap-1">
            <MapPin className="size-3" />
            <span>{event.location}</span>
          </div>
        )}

        {/* Attendees */}
        <div className="mb-4">
          <div className="block text-xs uppercase tracking-wider text-muted-fg mb-1">
            {tr(lang, "view.gcal.chip.attendeesLabel") || "Attendees"}
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
                      "inline-flex items-center gap-1 px-2 py-1 rounded text-xs",
                      "bg-muted/60 border border-border/60"
                    )}
                    title={status ? `${a} — ${status}` : a}
                  >
                    <span>{a}</span>
                    {status === "accepted" && (
                      <span className="text-green-600 text-[10px]">✓</span>
                    )}
                    {status === "declined" && (
                      <span className="text-red-500 text-[10px]">✗</span>
                    )}
                    {status === "tentative" && (
                      <span className="text-amber-600 text-[10px]">?</span>
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
            <div className="text-xs text-muted-fg mb-2 italic">
              {tr(lang, "view.gcal.chip.noAttendees") || "No attendees yet."}
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="email"
              placeholder={
                tr(lang, "view.gcal.chip.attendeePlaceholder") ||
                "name@example.com"
              }
              value={newAttendee}
              onChange={(e) => setNewAttendee(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addAttendee();
                }
              }}
              className="flex-1 border border-border rounded px-2 py-1 text-sm bg-bg outline-none focus:border-fg/40"
            />
            <button
              type="button"
              onClick={addAttendee}
              disabled={!newAttendee.includes("@")}
              className="text-xs px-3 py-1 rounded border border-border hover:bg-muted disabled:opacity-40"
            >
              {tr(lang, "view.gcal.chip.addAttendee") || "Add"}
            </button>
          </div>
        </div>

        {error && (
          <div className="text-xs text-red-600 mb-3">Error: {error}</div>
        )}

        <div className="flex items-center justify-between gap-2 pt-3 border-t border-border">
          <div className="flex gap-2">
            {event.html_link && (
              <button
                type="button"
                onClick={openInGoogle}
                className="text-xs text-muted-fg hover:text-fg underline underline-offset-2"
              >
                {tr(lang, "view.gcal.chip.openInGoogle") ||
                  "Open in Google Calendar"}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className="text-xs px-3 py-1.5 rounded border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {tr(lang, "view.gcal.chip.delete") || "Delete"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-xs px-3 py-1.5 rounded hover:bg-muted"
            >
              {tr(lang, "common.cancel") || "Cancel"}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={busy || !dirty}
              className="text-xs px-3 py-1.5 rounded bg-fg text-bg hover:opacity-90 disabled:opacity-40"
            >
              {busy
                ? tr(lang, "common.saving") || "Saving…"
                : tr(lang, "common.save") || "Save"}
            </button>
          </div>
        </div>
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
