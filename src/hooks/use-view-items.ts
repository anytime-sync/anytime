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
import { useTasks, type TaskWithTags, type TasksFilter } from "@/hooks/use-tasks";
import { useCalendarEvents } from "@/hooks/use-calendar";
import type { CalendarEvent } from "@/lib/db.types";
import { useAccountDay } from './use-account-day';
import { dayWindow } from '@/lib/day-window';
import type { GoogleCalendarEvent } from '@/lib/google-calendar';
import { taskViewWindow } from '@/lib/task-view-window';

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
function eventWindowForView(view: TasksFilter['view'], date: string, timeZone: string): { from: Date; to: Date } | null {
  if (view === 'inbox') return { from: new Date(), to: taskViewWindow('next90', date, timeZone)!.to };
  return taskViewWindow(view, date, timeZone);
}

export function useViewItems(filter: TasksFilter): {
  items: ViewItem[];
  isLoading: boolean;
  isError: boolean;
} {
  const tasksQuery = useTasks(filter);
  const day = useAccountDay();
  const win = useMemo(() => eventWindowForView(filter.view, day.date, day.timeZone), [filter.view, day.date, day.timeZone]);

  const eventsQuery = useCalendarEvents(
    win ?? { from: new Date(0), to: new Date(0) },
    !!win && !day.isPending && !day.error
  );

  const items = useMemo<ViewItem[]>(() => {
    const tasks = tasksQuery.data ?? [];
    const events = win ? eventsQuery.data ?? [] : [];

    const taskItems: ViewItem[] = tasks.map((task) => ({
      kind: "task",
      id: task.id,
      sortAt: (task.start_date ?? task.due_date)
        ? +dayWindow((task.start_date ?? task.due_date)!, day.timeZone).start
        : (task.start_at ?? task.due_at)
        ? new Date((task.start_at ?? task.due_at)!).getTime()
        : Number.POSITIVE_INFINITY,
      task,
    }));

    const eventItems: ViewItem[] = events.map((event) => ({
      kind: "event",
      id: `event:${event.id}`,
      sortAt: event.is_all_day && (event.raw as GoogleCalendarEvent | null)?.start?.date
        ? +dayWindow((event.raw as GoogleCalendarEvent).start!.date!, day.timeZone).start
        : event.start_at
        ? new Date(event.start_at).getTime()
        : Number.POSITIVE_INFINITY,
      event,
    }));

    return [...taskItems, ...eventItems];
  }, [tasksQuery.data, eventsQuery.data, win, day.timeZone]);

  return {
    items,
    isLoading: tasksQuery.isLoading || (win ? day.isPending || eventsQuery.isLoading : false),
    isError: tasksQuery.isError || !!(win && (day.error || eventsQuery.isError)),
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
