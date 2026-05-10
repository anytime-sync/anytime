"use client";

import { useState } from "react";
import { Calendar, Clock, MapPin } from "lucide-react";
import { format, isPast, isToday, isTomorrow } from "date-fns";
import type { CalendarEvent } from "@/lib/db.types";
import type { LanguageCode } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { EventEditDialog } from "./event-edit-dialog";

/**
 * Round F v4.2: render a Google Calendar event using the SAME visual layout
 * as TaskItem so events sit cleanly inside Today's task list instead of
 * looking like a foreign chip-strip pinned to the top.
 *
 * Visual parity with TaskItem:
 *   - left rail circle (calendar icon, muted) — replaces the "complete" toggle
 *   - title row (text-sm)
 *   - meta row: due chip · duration range · "Google Calendar" pill · location
 *
 * Click anywhere on the row → opens the shared EventEditDialog.
 */
export function EventTaskRow({
  event,
  lang,
}: {
  event: CalendarEvent;
  lang: LanguageCode | string;
}) {
  const [open, setOpen] = useState(false);

  const start = event.start_at ? new Date(event.start_at) : null;
  const end = event.end_at ? new Date(event.end_at) : null;
  const allDay = !!event.is_all_day;
  const title = event.title?.trim() || "Untitled event";

  const overdue = end ? !isToday(end) && isPast(end) : false;

  const dueLabel = (() => {
    if (!start) return "";
    if (isToday(start)) {
      return allDay ? "Today" : `Today ${format(start, "h:mm a")}`;
    }
    if (isTomorrow(start)) {
      return allDay ? "Tomorrow" : `Tomorrow ${format(start, "h:mm a")}`;
    }
    return allDay ? format(start, "MMM d") : format(start, "MMM d, h:mm a");
  })();

  const durLabel = (() => {
    if (allDay) return "All day";
    if (start && end) {
      return `${format(start, "h:mm a")}–${format(end, "h:mm a")}`;
    }
    return null;
  })();

  return (
    <>
      <div className="relative">
        <div
          onClick={() => setOpen(true)}
          className={cn(
            "group flex items-start gap-3 px-3 py-2 rounded-md cursor-pointer border border-transparent",
            "hover:bg-muted/60"
          )}
        >
          <div
            aria-label="Google Calendar event"
            title="Google Calendar event"
            className="mt-0.5 size-5 rounded-full border-2 border-muted-fg/60 grid place-items-center shrink-0 text-muted-fg"
          >
            <Calendar className="size-3" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm truncate">{title}</div>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-fg">
              {start && (
                <span className={cn("inline-flex items-center gap-1", overdue && "text-danger")}>
                  <Calendar className="size-3" /> {dueLabel}
                </span>
              )}
              {durLabel && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3" /> {durLabel}
                </span>
              )}
              <span
                className="inline-flex items-center gap-1 h-5 rounded px-1.5 text-[11px] font-medium leading-none"
                style={{
                  backgroundColor: "rgba(66, 133, 244, 0.12)",
                  color: "#1a73e8",
                  border: "1px solid rgba(66, 133, 244, 0.35)",
                }}
                title="Synced from Google Calendar"
              >
                Google Calendar
              </span>
              {event.location && (
                <span className="inline-flex items-center gap-1 max-w-[160px]">
                  <MapPin className="size-3 shrink-0" />
                  <span className="truncate">{event.location}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
      {open && (
        <EventEditDialog event={event} lang={lang} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
