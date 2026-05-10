"use client";

/**
 * Round F v4.3: unified view items.
 *
 * Combines tasks and Google Calendar events into a single chronologically
 * sorted list so the user's Today / Tomorrow / Next 7 / Next 90 / Inbox
 * pages render events alongside tasks based on their start/due time —
 * not as a separate "calendar" block.
 *
 * Each ViewItem is tagged with its kind so callers can render either
 * <TaskItem /> or <EventTaskRow /> per row. The sort key (`sortAt`) is
 * the task's due_at or the event's start_at; items with no date sink
 * to the bottom (POSITIVE_INFINITY).
 */

import { useMemo } from "react";
import { startOfDay, endOfDay, addDays } from "date-fns";
import { useTasks, type TaskWithTags, type TasksFilter } from "@/hooks/use-tasks";
import { useCalendarEvents } from "@/hooks/use-calendar";
import type { CalendarEvent } from "@/lib/db.types";

export type ViewItem =
  | {
      kind: "task";
      id: string;
      sortAt: number;
      task: TaskWithTags;
    }
  | {
      kind: "event";
      id: string;
      sortAt: number;
      event: CalendarEvent;
    };

/**
 * Compute the [from, to] window that should drive event fetching for
 * the given list view. Mirrors the date filters in useTasks so events
 * line up with tasks in the same view.
 *
 * For inbox / project / tag views the window is "now -> 90 days" so the
 * view shows upcoming events; we don't show past events outside the
 * Today bucket because they would otherwise pile up forever.
 */
function eventWindowForView(filter: TasksFilter): { from: Date; to: Date } | null {
  const now = new Date();
  const today = startOfDay(now);
  switch (filter.view) {
    case "today":
      return { from: today, to: endOfDay(now) };
    case "tomorrow": {
      const tomorrow = addDays(today, 1);
      return { from: tomorrow, to: endOfDay(tomorrow) };
    }
    case "next7":
      return { from: today, to: endOfDay(addDays(today, 6)) };
    case "next90":
      return { from: today, to: endOfDay(addDays(today, 89)) };
    case "inbox":
      return { from: now, to: endOfDay(addDays(today, 89)) };
    case "completed":
    case "all":
      return null;
    default:
      return null;
  }
}

export function useViewItems(filter: TasksFilter): {
  items: ViewItem[];
  isLoading: boolean;
} {
  const tasksQuery = useTasks(filter);
  const win = eventWindowForView(filter);

  const eventsQuery = useCalendarEvents(
    win ?? { from: new Date(0), to: new Date(0) }
  );

  const items = useMemo<ViewItem[]>(() => {
    const tasks = tasksQuery.data ?? [];
    const events = win ? eventsQuery.data ?? [] : [];

    const taskItems: ViewItem[] = tasks.map((task) => ({
      kind: "task",
      id: task.id,
      sortAt: task.due_at
        ? new Date(task.due_at).getTime()
        : Number.POSITIVE_INFINITY,
      task,
    }));

    const eventItems: ViewItem[] = events.map((event) => ({
      kind: "event",
      id: `event:${event.id}`,
      sortAt: event.start_at
        ? new Date(event.start_at).getTime()
        : Number.POSITIVE_INFINITY,
      event,
    }));

    return [...taskItems, ...eventItems];
  }, [tasksQuery.data, eventsQuery.data, win ? 1 : 0]);

  return {
    items,
    isLoading: tasksQuery.isLoading || (win ? eventsQuery.isLoading : false),
  };
}

/**
 * Sort ViewItems chronologically by sortAt. Items with the same time
 * are tiebroken by created_at / fetched_at so order is stable.
 */
export function byTimeAsc(a: ViewItem, b: ViewItem): number {
  if (a.sortAt !== b.sortAt) return a.sortAt - b.sortAt;
  const at =
    a.kind === "task"
      ? a.task.created_at
        ? new Date(a.task.created_at).getTime()
        : 0
      : a.event.fetched_at
      ? new Date(a.event.fetched_at).getTime()
      : 0;
  const bt =
    b.kind === "task"
      ? b.task.created_at
        ? new Date(b.task.created_at).getTime()
        : 0
      : b.event.fetched_at
      ? new Date(b.event.fetched_at).getTime()
      : 0;
  return at - bt;
}
