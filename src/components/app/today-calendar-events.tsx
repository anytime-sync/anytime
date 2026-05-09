"use client";

import { useMemo } from "react";
import { startOfDay, endOfDay } from "date-fns";
import { useCalendarEvents } from "@/hooks/use-calendar";
import { CalendarEventChip } from "@/components/app/calendar-event-chip";
import { useLanguage } from "@/lib/use-language";
import { t as tr } from "@/lib/i18n";

/**
 * Horizontal compact row of today's calendar events, rendered in the
 * Today list view above the Quick Add input. Hidden when there are no
 * events so the list view stays clean for users who haven't connected
 * a calendar (or who simply have a free day).
 */
export function TodayCalendarEvents() {
  const lang = useLanguage();
  const { from, to } = useMemo(() => {
    const now = new Date();
    return { from: startOfDay(now), to: endOfDay(now) };
  }, []);
  const { data: events = [] } = useCalendarEvents({ from, to });

  if (events.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <p className="editorial-number text-[10px]">
        {tr(lang, "view.today.events.heading")}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {events.map((ev) => (
          <CalendarEventChip key={ev.id} event={ev} lang={lang} />
        ))}
      </div>
    </div>
  );
}
