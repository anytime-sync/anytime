"use client";

import { useAccountDay } from './use-account-day';
import { calendarDate } from '@/lib/day-window';
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { CalendarEvent } from "@/lib/db.types";

/**
 * Hooks for the Round F Google Calendar integration.
 *
 *   useCalendarConnection() — { connected, account_email, last_sync_at }
 *                              for the Settings page.
 *   useCalendarEvents()     — RLS-gated read directly from supabase
 *                              (no API route needed). Filters on
 *                              start_at within the [from, to] window.
 *   useDisconnectCalendar() — POST /api/calendar/google/disconnect.
 *   useSyncCalendarNow()    — POST /api/calendar/google/sync-now.
 */

export type CalendarConnection = {
  connected: boolean;
  account_email: string | null;
  last_sync_at: string | null;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let msg = `${res.status}`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j?.error) msg = j.error;
    } catch {
      /* noop */
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

export function useCalendarConnection() {
  return useQuery({
    queryKey: ["calendarConnection"],
    queryFn: () => fetchJson<CalendarConnection>("/api/calendar/google/status"),
  });
}

export function useCalendarEvents({ from, to }: { from: Date; to: Date }, enabled = true) {
  const { timeZone } = useAccountDay();
  const fromDate = calendarDate(from, timeZone), toDate = calendarDate(to, timeZone);
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  return useQuery({
    queryKey: ["calendarEvents", fromIso, toIso, timeZone],
    enabled,
    queryFn: async () => {
      const supabase = createClient();
      // Cancelled events stay in the table for audit; hide them in the
      // app. Window query: anything that overlaps [from, to] — i.e.
      // start_at < to AND end_at > from. We use string comparisons,
      // which is safe for ISO 8601 timestamps.
      const { data, error } = await supabase
        .from("calendar_events")
        .select(
          "id, user_id, provider, external_id, calendar_id, title, description, location, start_at, end_at, is_all_day, status, html_link, organizer_email, attendees_count, raw, fetched_at, cancelled"
        )
        .eq("cancelled", false)
        .or(`and(is_all_day.eq.true,raw->start->>date.lt.${toDate},raw->end->>date.gt.${fromDate}),and(raw->start->>date.is.null,start_at.lt.${toIso},end_at.gt.${fromIso})`)
        .order("start_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CalendarEvent[];
    },
  });
}

export function useDisconnectCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      fetchJson<{ ok: boolean }>("/api/calendar/google/disconnect", {
        method: "POST",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calendarConnection"] });
      qc.invalidateQueries({ queryKey: ["calendarEvents"] });
    },
    onError: (e: Error) => {
      toast.error(e.message);
    },
  });
}

export function useSyncCalendarNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      fetchJson<import("@/lib/calendar-sync-now").SyncNowResult>(
        "/api/calendar/google/sync-now",
        { method: "POST" }
      ),
    onSuccess: result => {
      if (!result.ok) toast.error(`Calendar sync incomplete: ${result.pending ?? '?'} tasks pending, ${result.pending_deletions ?? '?'} deletions pending, ${result.conflicts ?? '?'} conflicts. ${result.inbound.error || result.outbound.error || result.deletions.error || result.error || ''}`);
    },
    onSettled: () => {
      for (const key of ['calendarEvents', 'calendarConnection', 'tasks', 'task', 'subtasks', 'subtaskCounts', 'calendarSyncIssues', 'upcoming-reminders']) void qc.invalidateQueries({ queryKey: [key] });
    },
    onError: (e: Error) => {
      toast.error(e.message);
    },
  });
}
