"use client";

import { CalendarDays, MapPin } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "@/lib/db.types";
import { getLanguage, t as tr } from "@/lib/i18n";
import type { LanguageCode } from "@/lib/i18n";

/**
 * Editorial chip for a Google Calendar event.
 *
 * Visually distinct from task cards on purpose — these aren't TDL
 * tasks, they're external commitments. Muted background, no checkbox,
 * calendar-glyph leading icon. Click opens the event in Google
 * Calendar (event.html_link) in a new tab so the user can edit it
 * where it lives.
 *
 * Three sizing variants:
 *   - "default": full chip used in horizontal rows / day cells
 *   - "compact": tighter version for the month grid where vertical
 *     space is at a premium (no location, smaller type)
 *   - "timeline": absolute-positioned variant for the day timeline,
 *     spans the event's full height and shows time + title.
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

  const timeLabel = (() => {
    if (allDay) return tr(lang, "view.gcal.chip.allDay");
    if (!start) return "";
    const s = format(start, "h:mm", { locale: dfLocale });
    if (!end) return s;
    return `${s}–${format(end, "h:mm", { locale: dfLocale })}`;
  })();

  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (event.html_link) {
      window.open(event.html_link, "_blank", "noopener,noreferrer");
    }
  };

  const title = event.title?.trim() || tr(lang, "view.gcal.chip.untitled");

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
}
