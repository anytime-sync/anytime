import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getUserPlan } from "./billing";import { type Plan } from "./plans";import { canUseFeature } from "./feature-flags";

/**
 * Per-user AI rate limiting. Daily budgets are intentionally generous
 * for free-tier usage but cap any single user from running away with
 * Anthropic costs.
 *
 * Budgets (calls per UTC day):
 *   parse_task     — 200  (each inline-edit + every quick-add)
 *   quadrant       —  50
 *   daily_edition  —  50  (cached per day; budget gives plenty of
 *                          headroom for language switches + manual
 *                          regen during testing)
 *   weekly_retro   —  30  (cached per week)
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
  | "morning_copilot"
  | "search"
  | "translate_task"
  | "reflection";

export const AI_DAILY_LIMITS: Record<AiFeature, number> = {
  parse_task: 200,
  quadrant: 50,
  daily_edition: 50,
  weekly_retro: 30,
  // plan_week is batch (≤3d tasks per call), so a low daily count is plenty.
  plan_week: 30,
  // plan_day is the morning ritual — once or twice a day max.
  plan_day: 30,
  // estimate_task: small, quick, fires on every task add. Generous budget.
  estimate_task: 200,
  // reschedule_task: bulk handles many at once; per-task surface is rarer.
  reschedule_task: 60,
  // find_time: opt-in click action; small budget reflects intent.
  find_time: 60,
  // auto_triage: silent quadrant classification on every add. Same as quadrant.
  auto_triage: 100,
  // prep_meeting: opt-in agenda generation; cached after first call.
  prep_meeting: 60,
  // procrastination: weekly cleanup pass; once a week is plenty.
  procrastination: 20,
  // goal_decompose: turning a written goal into a task tree; budget keeps it deliberate.
  goal_decompose: 30,
  // morning_copilot: Round E proactive brief; once a day per user.
  morning_copilot: 30,
  // search: NL palette query; cheap re-rank — generous budget.
  search: 100,
  // translate_task: per-task per-locale; cached aggressively. Budget high
  // because new shared tasks across many languages can fan out fast.
  translate_task: 300,
  // reflection: nightly per-user wrap-up summary; once a day max.
  reflection: 30,
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

  // Plan gate — AI features are Pro-only. Free / Plus users hit a hard
  // limit (used:999, limit:0). The frontend can detect limit===0 to show
  // an Upgrade-to-Pro CTA instead of a "rate limited" message.
  const plan = await getUserPlan(userId);
  const AI_FEATURE_ID: Partial<Record<AiFeature, string>> = {daily_edition:"ai_daily_edition",weekly_retro:"review_weekly_retro",plan_week:"ai_plan_my_week",plan_day:"ai_plan_my_day",morning_copilot:"ai_morning_copilot",auto_triage:"ai_smart_eisenhower",quadrant:"ai_smart_eisenhower",goal_decompose:"ai_goal_tracker",search:"data_semantic_search",reflection:"review_reflect",parse_task:"ai_parse_task",estimate_task:"ai_estimate_task",translate_task:"ai_translate_task",reschedule_task:"ai_reschedule_task",find_time:"ai_find_time",prep_meeting:"ai_prep_meeting",procrastination:"ai_procrastination"}; const _fid = AI_FEATURE_ID[feature]; if (_fid && !(await canUseFeature(plan as Plan, _fid))) {
    return { ok: false, retryAfter: secondsUntilUtcMidnight(), used: 999, limit: 0 };
  }  const supa = admin();
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


/**
 * Approximate per-token cost in USD for cost tracking.
 * Updated 2026-06. These are estimates — actual billing may differ slightly.
 */
const MODEL_COST_PER_TOKEN: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5-20251001":  { input: 0.80 / 1_000_000, output: 4.00 / 1_000_000 },
  // Current Sonnet 4.6 (editorial). Replaces retired claude-sonnet-4-20250514.
  "claude-sonnet-4-6":          { input: 3.00 / 1_000_000, output: 15.00 / 1_000_000 },
  // Keep the old id for historical cost lookups on already-logged rows.
  "claude-sonnet-4-20250514":   { input: 3.00 / 1_000_000, output: 15.00 / 1_000_000 },
};

/** Estimate USD cost from model + token counts. Returns null if unknown model. */
export function estimateCostUsd(
  model: string | undefined,
  inputTokens: number | undefined,
  outputTokens: number | undefined,
): number | null {
  if (!model || inputTokens == null || outputTokens == null) return null;
  const rates = MODEL_COST_PER_TOKEN[model];
  if (!rates) return null;
  return rates.input * inputTokens + rates.output * outputTokens;
}

/** Log a call after we've made it. Best-effort. */
export async function logAiCall(
  userId: string,
  feature: AiFeature,
  opts: { model?: string; status?: number; inputTokens?: number; outputTokens?: number } = {}
): Promise<void> {
  try {
    const supa = admin();
    const cost = estimateCostUsd(opts.model, opts.inputTokens, opts.outputTokens);
    await supa.from("ai_usage_log").insert({
      user_id: userId,
      feature,
      model: opts.model ?? null,
      status: opts.status ?? null,
      input_tokens: opts.inputTokens ?? null,
      output_tokens: opts.outputTokens ?? null,
      estimated_cost_usd: cost,
    });
  } catch (e) {
    console.error("[ai_rate_limit] log failed", e);
  }
}
