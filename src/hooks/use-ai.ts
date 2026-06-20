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
 * model can weight them against each other (one item is the most
 * important THIS week — that's only visible across the whole list).
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
      if (r.status === 429) {
        // Rate limited — don't throw (TanStack would retry), and don't
        // wipe cached data. Return null with a sentinel so the card
        // can show "daily AI cap reached" instead of a generic error.
        const j = await r.json().catch(() => ({} as { used?: number; limit?: number }));
        const err = new Error("rate_limited");
        (err as Error & { code?: string; used?: number; limit?: number }).code = "rate_limited";
        (err as Error & { code?: string; used?: number; limit?: number }).used = j.used;
        (err as Error & { code?: string; used?: number; limit?: number }).limit = j.limit;
        throw err;
      }
      if (!r.ok) throw new Error(`edition_failed ${r.status}`);
      const row = (await r.json()) as DailyEditionRow;
      qc.setQueryData(["dailyEdition"], row);
      return row;
    },
    staleTime: 60 * 60_000,
    // Don't churn the AI by retrying — the route itself is idempotent
    // but each retry would burn another budget slot.
    retry: false,
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
      if (r.status === 429) {
        const err = new Error("rate_limited");
        (err as Error & { code?: string }).code = "rate_limited";
        throw err;
      }
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
  // Smarter-retro additions live inside raw_json so older cached rows
  // remain valid without a schema migration.
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
  email_daily_digest: boolean;
  email_broadcasts: boolean;
  timezone: string;
  digest_send_hour: number;
  // ICS calendar subscription — token is opaque, never displayed
  // verbatim outside Settings → Calendar sync.
  ics_feed_token: string | null;
  ics_feed_created_at: string | null;
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

export function usePlanDay() {
  return useMutation({
    mutationFn: async (
      tasks: PlanWeekTaskInput[]
    ): Promise<PlanWeekResult | null> => {
      const r = await fetch("/api/ai/plan-day", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tasks }),
      });
      if (r.status === 503) return null;
      if (!r.ok) throw new Error(`plan-day ${r.status}`);
      return (await r.json()) as PlanWeekResult;
    },
  });
}

/* ---------- new AI helpers (estimate, reschedule, find-time, prep-meeting) ---------- */

export type EstimateTaskInput = {
  task_id: string;
  title: string;
  notes?: string | null;
  project?: string | null;
  tags?: string[];
};
export type EstimateTaskResult = {
  minutes: number;
  confidence: "low" | "med" | "high";
  rationale: string;
};

export function useEstimateTask() {
  return useMutation({
    mutationFn: async (input: EstimateTaskInput): Promise<EstimateTaskResult | null> => {
      const r = await fetch("/api/ai/estimate-task", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (r.status === 503) return null;
      if (!r.ok) throw new Error(`estimate ${r.status}`);
      return (await r.json()) as EstimateTaskResult;
    },
  });
}

export type RescheduleInput = {
  tasks: Array<{
    id: string;
    title: string;
    due_at: string | null;
    priority: number;
    days_overdue: number;
    estimated_minutes?: number | null;
  }>;
};
export type RescheduleSuggestion = {
  id: string;
  /** New slot start (replaces new_due_at; AI picks a real free slot). */
  start_at: string | null;
  /** New slot end = start + task duration. */
  due_at: string | null;
  /** Legacy field — kept for backward compat; prefer start_at/due_at. */
  new_due_at?: string | null;
  verdict: "reschedule" | "defer-far" | "drop";
  reason: string;
};

export function useRescheduleTasks() {
  return useMutation({
    mutationFn: async (input: RescheduleInput): Promise<{ suggestions: RescheduleSuggestion[] } | null> => {
      const r = await fetch("/api/ai/reschedule-task", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (r.status === 503) return null;
      if (!r.ok) throw new Error(`reschedule ${r.status}`);
      return (await r.json()) as { suggestions: RescheduleSuggestion[] };
    },
  });
}

export type FindTimeInput = {
  task_id: string;
  title: string;
  estimated_minutes?: number | null;
};
export type TimeSlot = {
  start_at: string;
  end_at: string;
  label: string;
  fit: "best" | "good" | "backup";
};

export function useFindTime() {
  return useMutation({
    mutationFn: async (input: FindTimeInput): Promise<{ slots: TimeSlot[] } | null> => {
      const r = await fetch("/api/ai/find-time", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (r.status === 503) return null;
      if (!r.ok) throw new Error(`find-time ${r.status}`);
      return (await r.json()) as { slots: TimeSlot[] };
    },
  });
}

export type PrepMeetingInput = {
  task_id: string;
  title: string;
  notes?: string | null;
  refresh?: boolean;
};
export type MeetingPrep = {
  agenda: string[];
  questions: string[];
  cached?: boolean;
};

export function usePrepMeeting() {
  return useMutation({
    mutationFn: async (input: PrepMeetingInput): Promise<MeetingPrep | null> => {
      const r = await fetch("/api/ai/prep-meeting", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (r.status === 503) return null;
      if (!r.ok) throw new Error(`prep-meeting ${r.status}`);
      return (await r.json()) as MeetingPrep;
    },
  });
}

/* ---------- deferred-bundle hooks ---------- */

export type ProcrastinationItem = {
  id: string;
  verdict: "drop" | "break-down" | "schedule";
  reason: string;
  subtasks: string[];
};

export function useProcrastination() {
  return useMutation({
    mutationFn: async (): Promise<{ items: ProcrastinationItem[]; summary: string } | null> => {
      const r = await fetch("/api/ai/procrastination", { method: "POST" });
      if (r.status === 503) return null;
      if (!r.ok) throw new Error(`procrastination ${r.status}`);
      return await r.json();
    },
  });
}

export type GoalTask = {
  title: string;
  due_offset_days: number;
  priority: 0 | 1 | 3 | 5;
  quadrant: 1 | 2 | 3 | 4;
  rationale: string;
};
export type GoalDecomposed = {
  project_name: string;
  summary: string;
  tasks: GoalTask[];
};

export function useGoalDecompose() {
  return useMutation({
    mutationFn: async (goal: string): Promise<GoalDecomposed | null> => {
      const r = await fetch("/api/ai/goal-decompose", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ goal }),
      });
      if (r.status === 503) return null;
      if (!r.ok) throw new Error(`goal-decompose ${r.status}`);
      return await r.json();
    },
  });
}

export type SearchMatch = { id: string; why: string };

export function useNlSearch() {
  return useMutation({
    mutationFn: async (query: string): Promise<{ matches: SearchMatch[] } | null> => {
      const r = await fetch("/api/ai/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (r.status === 503) return null;
      if (!r.ok) throw new Error(`search ${r.status}`);
      return await r.json();
    },
  });
}

export function useTranslateTask() {
  return useMutation({
    mutationFn: async (input: {
      task_id: string;
      source_title: string;
      target_locale: string;
    }): Promise<{ translation: string; cached?: boolean } | null> => {
      const r = await fetch("/api/ai/translate-task", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (r.status === 503) return null;
      if (!r.ok) throw new Error(`translate ${r.status}`);
      return await r.json();
    },
  });
}

export type Reflection = {
  headline: string;
  body: string;
  carry_forward_ids: string[];
  drop_suggestions_ids: string[];
  user_journal?: string | null;
  local_date?: string;
};

export function useReflection() {
  return useMutation({
    mutationFn: async (): Promise<Reflection | null> => {
      const r = await fetch("/api/ai/reflection");
      if (r.status === 503) return null;
      if (!r.ok) throw new Error(`reflection ${r.status}`);
      return await r.json();
    },
  });
}

export function useSaveReflectionJournal() {
  return useMutation({
    mutationFn: async (journal: string) => {
      const r = await fetch("/api/ai/reflection", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ journal }),
      });
      if (!r.ok) throw new Error(`save-journal ${r.status}`);
    },
  });
}

/* ---------- Morning Co-pilot (Round E v1) ---------- */

export type MorningCopilotActionKind =
  | "defer"
  | "drop"
  | "batch"
  | "reschedule";

export type MorningCopilotAction = {
  kind: MorningCopilotActionKind;
  task_id: string;
  reason: string;
};

export type MorningCopilotBrief = {
  kicker: string;
  headline: string;
  intro: string;
  clarifying_question: string | null;
  suggested_actions: MorningCopilotAction[];
  closing_intent: string;
  applied_action_indexes?: number[];
};

export type MorningCopilotRow = {
  user_id: string;
  local_date: string;
  language: string;
  brief: MorningCopilotBrief;
  status: "open" | "snoozed" | "dismissed" | "applied";
  surfaced_at: string | null;
  responded_at: string | null;
};

/**
 * Fetch (or generate) today's Morning Co-pilot brief. Cached server-side
 * by (user, local_date, language) — calling this hook on Today mount is
 * cheap on the budget when the row already exists.
 *
 * Resolves to:
 *   - the row when it exists / was just generated
 *   - null when AI is disabled (503)
 *   - throws Error with code='rate_limited' on 429 (caller hides quietly)
 */
export function useMorningCopilot() {
  return useQuery({
    queryKey: ["morningCopilot"],
    queryFn: async (): Promise<MorningCopilotRow | null> => {
      const r = await fetch("/api/ai/morning-copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tz: tz() }),
      });
      if (r.status === 503) return null;
      if (r.status === 429) {
        const j = (await r.json().catch(() => ({}))) as {
          used?: number;
          limit?: number;
        };
        const err = new Error("rate_limited") as Error & {
          code?: string;
          used?: number;
          limit?: number;
        };
        err.code = "rate_limited";
        err.used = j.used;
        err.limit = j.limit;
        throw err;
      }
      if (!r.ok) throw new Error(`copilot_failed ${r.status}`);
      return (await r.json()) as MorningCopilotRow;
    },
    retry: false,
    staleTime: 60 * 60_000,
  });
}

/**
 * Apply / Snooze / Dismiss the current Morning Co-pilot brief. Mutating
 * task rows is the card's job (RLS-gated client mutations); this only
 * flips the brief row's status + stashes the picked indexes.
 */
export function useRespondToCopilot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      action: "apply" | "snooze" | "dismiss";
      applied_action_indexes?: number[];
    }) => {
      const r = await fetch("/api/ai/morning-copilot/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, tz: tz() }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `respond_failed ${r.status}`);
      }
      return (await r.json()) as MorningCopilotRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["morningCopilot"] });
    },
  });
}
