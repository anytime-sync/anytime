"use client";

import { CalendarDays, MapPin } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "@/lib/db.types";
import { getLanguage } from "@/lib/i18n";
import type { LanguageCode } from "@/lib/i18n";
import { EventEditDialog } from "./event-edit-dialog";

/**
 * Editorial chip for a Google Calendar event — used on the calendar page's
 * month grid + day timeline. Today's list view uses EventTaskRow instead
 * (which mirrors TaskItem's visual layout for a unified Today list).
 *
 * Both surfaces open the SAME EventEditDialog so editing behavior is
 * consistent: gap-preserving start/due, attendees panel, scope radio for
 * recurring events.
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
    if (allDay) return "All day";
    if (!start) return "";
    const s = format(start, "h:mm", { locale: dfLocale });
    if (!end) return s;
    return `${s}–${format(end, "h:mm", { locale: dfLocale })}`;
  })();

  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(true);
  };

  const title = event.title?.trim() || "Untitled event";

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
          title={`${title}${event.location ? " — " + event.location : ""} (Google Calendar)`}
          style={style}
          className={cn(
            "absolute rounded-md text-left px-2 py-1 pointer-events-auto",
            "bg-muted/60 border border-border text-fg/90",
            "hover:bg-muted hover:border-fg/30 transition-colors",
            "flex flex-col gap-0.5 overflow-hidden cursor-pointer select-none",
            className
          )}
        >
          <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wider tabular-nums text-muted-fg">
            <CalendarDays className="size-3" />
            {timeLabel}
          </span>
          <span className="text-sm font-medium leading-snug truncate">{title}</span>
          {event.location && (
            <span className="text-[11px] text-muted-fg leading-snug truncate">
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
          title={`${title}${event.location ? " — " + event.location : ""} (Google Calendar)`}
          className={cn(
            "w-full inline-flex items-center gap-1 px-1.5 h-6 rounded text-[11px]",
            "bg-muted/60 hover:bg-muted text-fg/85",
            "min-w-0 text-left",
            className
          )}
        >
          <CalendarDays className="size-3 shrink-0 text-muted-fg" />
          <span className="tabular-nums text-muted-fg shrink-0">{timeLabel}</span>
          <span className="truncate">{title}</span>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={onClick}
        title={`${title}${event.location ? " — " + event.location : ""} (Google Calendar)`}
        className={cn(
          "inline-flex items-center gap-1.5 px-2 h-8 rounded-md text-sm",
          "bg-muted/60 hover:bg-muted text-fg/90 transition-colors",
          "border border-border/60 hover:border-border",
          "min-w-0 max-w-full",
          className
        )}
      >
        <CalendarDays className="size-3.5 shrink-0 text-muted-fg" />
        <span className="tabular-nums text-muted-fg shrink-0 text-xs">{timeLabel}</span>
        <span className="truncate font-medium">{title}</span>
        <span className="hidden md:inline text-[11px] text-muted-fg shrink-0 ml-1 italic">
          · Google Calendar
        </span>
        {event.location && (
          <span className="hidden sm:inline-flex items-center gap-0.5 text-xs text-muted-fg shrink-0 max-w-[140px]">
            <MapPin className="size-3" />
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
        <EventEditDialog event={event} lang={lang} onClose={() => setEditing(false)} />
      )}
    </>
  );
}
