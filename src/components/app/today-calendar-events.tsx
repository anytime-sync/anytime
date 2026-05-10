"use client";

import { useMemo } from "react";
import { startOfDay, endOfDay } from "date-fns";
import { useCalendarEvents } from "@/hooks/use-calendar";
import { EventTaskRow } from "@/components/app/event-task-row";
import { useLanguage } from "@/lib/use-language";

/**
 * Round F v4.2: today's Google Calendar events rendered as task-style rows.
 *
 * Previously this was a horizontal chip-strip with its own "ON YOUR CALENDAR
 * TODAY" heading, which made events feel like a separate, foreign list. Now
 * each event is rendered as an EventTaskRow that visually matches TaskItem,
 * with a "Google Calendar" pill on the meta row instead of a project pill.
 *
 * Events are sorted by start time so they stack chronologically. They're
 * still rendered in the prelude slot (above the task list) so the time-of-
 * day sort remains intuitive — events almost always start earlier in the
 * day than tasks (which tend to be due by EOD), and stacking them at the
 * top reads naturally on a single timeline.
 */
export function TodayCalendarEvents() {
  const lang = useLanguage();
  const { from, to } = useMemo(() => {
    const now = new Date();
    return { from: startOfDay(now), to: endOfDay(now) };
  }, []);
  const { data: events = [] } = useCalendarEvents({ from, to });

  const sorted = useMemo(() => {
    return [...events].sort((a, b) => {
      const aT = a.start_at ? new Date(a.start_at).getTime() : 0;
      const bT = b.start_at ? new Date(b.start_at).getTime() : 0;
      return aT - bT;
    });
  }, [events]);

  if (sorted.length === 0) return null;

  return (
    <div className="space-y-1">
      {sorted.map((ev) => (
        <EventTaskRow key={ev.id} event={ev} lang={lang} />
      ))}
    </div>
  );
}
