import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Per-user AI rate limiting. Daily budgets are intentionally generous
 * for free-tier usage but cap any single user from running away with
 * Anthropic costs.
 *
 * Budgets (calls per UTC day):
 *   parse_task     — 200  (each inline-edit + every quick-add)
 *   quadrant       —  50
 *   daily_edition  —   8  (cached so usually 1; force-regen ~7 retries)
 *   weekly_retro   —   8  (cached per week; ~few language switches)
 *
 * Returns {ok:true} when within budget. Otherwise {ok:false, retryAfter}
 * with seconds-til-tomorrow-UTC.
 *
 * Uses the service-role client (bypasses RLS) so the count is honest
 * regardless of which user is calling. The recording happens after the
 * actual AI call so we record the model + status from the response.
 */
export type AiFeature =
  | "parse_task"
  | "quadrant"
  | "daily_edition"
  | "weekly_retro"
  | "plan_week"
  | "plan_day"
  | "estimate_task"
  | "reschedule_task"
  | "find_time"
  | "auto_triage"
  | "prep_meeting"
  | "procrastination"
  | "goal_decompose"
  | "search"
  | "translate_task"
  | "reflection";

export const AI_DAILY_LIMITS: Record<AiFeature, number> = {
  parse_task: 200,
  quadrant: 50,
  daily_edition: 8,
  weekly_retro: 8,
  // plan_week is batch (≤3d tasks per call), so a low daily count is plenty.
  plan_week: 10,
  // plan_day is the morning ritual — once or twice a day max.
  plan_day: 12,
  // estimate_task: small, quick, fires on every task add. Generous budget.
  estimate_task: 200,
  // reschedule_task: bulk handles many at once; per-task surface is rarer.
  reschedule_task: 30,
  // find_time: opt-in click action; small budget reflects intent.
  find_time: 30,
  // auto_triage: silent quadrant classification on every add. Same as quadrant.
  auto_triage: 100,
  // prep_meeting: opt-in agenda generation; cached after first call.
  prep_meeting: 25,
  // procrastination: weekly cleanup pass; once a week is plenty.
  procrastination: 5,
  // goal_decompose: turning a written goal into a task tree; budget keeps it deliberate.
  goal_decompose: 10,
  // search: NL palette query; cheap re-rank — generous budget.
  search: 100,
  // translate_task: per-task per-locale; cached aggressively. Budget high
  // because new shared tasks across many languages can fan out fast.
  translate_task: 300,
  // reflection: nightly per-user wrap-up summary; once a day max.
  reflection: 5,
};

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function startOfUtcDay(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function secondsUntilUtcMidnight(): number {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  return Math.ceil((+tomorrow - +now) / 1000);
}

/** Check the budget. Throws no error; returns the decision. */
export async function checkAiBudget(userId: string, feature: AiFeature): Promise<
  { ok: true } | { ok: false; retryAfter: number; used: number; limit: number }
> {
  const supa = admin();
  const limit = AI_DAILY_LIMITS[feature];
  const sinceIso = startOfUtcDay();

  const { count, error } = await supa
    .from("ai_usage_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("feature", feature)
    .gte("created_at", sinceIso);
  if (error) {
    console.error("[ai_rate_limit]", error);
    // Soft-fail open: if we can't check, don't block usage.
    return { ok: true };
  }
  const used = count ?? 0;
  if (used >= limit) {
    return { ok: false, retryAfter: secondsUntilUtcMidnight(), used, limit };
  }
  return { ok: true };
}

/** Log a call after we've made it. Best-effort. */
export async function logAiCall(
  userId: string,
  feature: AiFeature,
  opts: { model?: string; status?: number } = {}
): Promise<void> {
  try {
    const supa = admin();
    await supa.from("ai_usage_log").insert({
      user_id: userId,
      feature,
      model: opts.model ?? null,
      status: opts.status ?? null,
    });
  } catch (e) {
    console.error("[ai_rate_limit] log failed", e);
  }
}
