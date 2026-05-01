"use client";

import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

const tz = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

export type ParsedTask = {
  title: string;
  start_at?: string | null;
  due_at: string | null;
  is_all_day: boolean;
  priority: 0 | 1 | 3 | 5;
  tagNames: string[];
  projectName: string | null;
  rrule: string | null;
  reminder_at: string | null;
  estimated_minutes: number | null;
};

/**
 * One task extracted from a scanned image. Mirrors the server-side
 * ScannedTaskSchema in src/lib/ai/types.ts.
 */
export type ScannedTask = {
  title: string;
  start_at?: string | null;
  due_at: string | null;
  is_all_day?: boolean;
  priority: 0 | 1 | 3 | 5;
  tagNames?: string[];
  projectName?: string | null;
  rrule?: string | null;
  reminder_at?: string | null;
  estimated_minutes?: number | null;
};

/**
 * Scan an image -> Claude vision -> array of tasks. Resolves to null when
 * AI is disabled (503) so the caller can prompt the user to enable it.
 */
export function useScanTasksAI() {
  return useMutation({
    mutationFn: async (
      file: File
    ): Promise<{ tasks: ScannedTask[] } | null> => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("tz", tz());
      const r = await fetch("/api/ai/scan-tasks", {
        method: "POST",
        body: fd,
      });
      if (r.status === 503) return null;
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `scan_failed ${r.status}`);
      }
      return (await r.json()) as { tasks: ScannedTask[] };
    },
  });
}

/** LLM-powered quick-add parser. Resolves to null when AI is disabled (503). */
export function useParseTaskAI() {
  return useMutation({
    mutationFn: async (text: string): Promise<ParsedTask | null> => {
      const r = await fetch("/api/ai/parse-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, tz: tz() }),
      });
      if (r.status === 503) return null;        // AI off — caller falls back
      if (!r.ok) throw new Error(`parse_failed ${r.status}`);
      return (await r.json()) as ParsedTask;
    },
  });
}

export function useSuggestQuadrant() {
  return useMutation({
    mutationFn: async (input: {
      title: string;
      due_at?: string | null;
      priority?: number;
      project?: string | null;
    }): Promise<{ quadrant: 1 | 2 | 3 | 4; reason: string } | null> => {
      const r = await fetch("/api/ai/quadrant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (r.status === 503) return null;
      if (!r.ok) throw new Error(`quadrant_failed ${r.status}`);
      return await r.json();
    },
  });
}

export type PlanWeekTaskInput = {
  id: string;
  title: string;
  due_at?: string | null;
  priority: number;
  project?: string | null;
};

export type PlanWeekSuggestion = {
  id: string;
  quadrant: 1 | 2 | 3 | 4;
  suggested_priority: 0 | 1 | 3 | 5;
  reason: string;
};

export type PlanWeekResult = {
  suggestions: PlanWeekSuggestion[];
  notes: string;
};

/**
 * Batch-plan the next 7 days. Sends up to 30 tasks in one shot so the
 * model can weight them against each other.
 */
export function usePlanWeek() {
  return useMutation({
    mutationFn: async (
      tasks: PlanWeekTaskInput[]
    ): Promise<PlanWeekResult | null> => {
      const r = await fetch("/api/ai/plan-week", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks }),
      });
      if (r.status === 503) return null;
      if (!r.ok) throw new Error(`plan_week_failed ${r.status}`);
      return (await r.json()) as PlanWeekResult;
    },
  });
}

export type DailyEditionRow = {
  user_id: string;
  edition_date: string;
  kicker: string;
  headline: string;
  front_page: string;
  inside: string;
  below_fold: string;
  generated_at?: string;
  model?: string;
};

export function useDailyEdition() {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ["dailyEdition"],
    queryFn: async (): Promise<DailyEditionRow | null> => {
      const r = await fetch("/api/ai/daily-edition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tz: tz() }),
      });
      if (r.status === 503) return null;       // AI off
      if (!r.ok) throw new Error(`edition_failed ${r.status}`);
      const row = (await r.json()) as DailyEditionRow;
      qc.setQueryData(["dailyEdition"], row);
      return row;
    },
    staleTime: 60 * 60_000,
  });
}

export function useRegenerateEdition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/ai/daily-edition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tz: tz(), force: true }),
      });
      if (r.status === 503) return null;
      if (!r.ok) throw new Error(`edition_failed ${r.status}`);
      return await r.json();
    },
    onSuccess: (row) => {
      if (row) qc.setQueryData(["dailyEdition"], row);
    },
  });
}

export type WeeklyRetroRow = {
  user_id: string;
  iso_year: number;
  iso_week: number;
  week_start: string;
  shipped: string;
  slipped: string;
  drop_list: string;
  /** Smarter-retro additions live in raw_json so older rows still validate. */
  raw_json?: {
    themes?: string;
    next_week_plan?: string;
    language?: string;
  } & Record<string, unknown>;
};

export function useWeeklyRetro(target: "last" | "current" = "last") {
  return useQuery({
    queryKey: ["weeklyRetro", target],
    queryFn: async (): Promise<WeeklyRetroRow | null> => {
      const r = await fetch("/api/ai/weekly-retro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tz: tz(), target }),
      });
      if (r.status === 503) return null;
      if (!r.ok) throw new Error(`retro_failed ${r.status}`);
      return await r.json();
    },
    staleTime: 60 * 60_000,
    // Keep the previously rendered retro on screen while a refetch
    // (e.g. language change → cache invalidation) is in flight. The
    // page also reads `isFetching` to show a subtle 'Updating…' chip.
    placeholderData: keepPreviousData,
  });
}

/** User preferences — capacity caps, AI toggles, energy windows. */
export type UserPrefs = {
  user_id: string;
  daily_capacity_minutes: number;
  default_task_minutes: number;
  energy_peak_start: string;
  energy_peak_end: string;
  ai_enabled: boolean;
  ai_auto_quadrant: boolean;
  ai_daily_edition: boolean;
  ai_voice_enabled: boolean;
  language: "en" | "zh-TW" | "zh-CN" | "ja" | "ko";
  email_reminders: boolean;
  push_reminders: boolean;
};

export function useUserPrefs() {
  return useQuery({
    queryKey: ["userPrefs"],
    queryFn: async (): Promise<UserPrefs | null> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("user_preferences")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return (data as UserPrefs) ?? null;
    },
  });
}

export function useUpdatePrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<UserPrefs>) => {
      const supabase = createClient();
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("user_preferences")
        .upsert({ user_id: u.user.id, ...patch });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["userPrefs"] }),
  });
}
