import { getAnthropic, MODELS } from "@/lib/anthropic";
import { logAiCall } from "@/lib/ai-rate-limit";
import { dailyEditionSystem } from "@/lib/ai/prompts";
import { DailyEditionSchema, extractJson } from "@/lib/ai/types";
import type { LanguageCode } from "@/lib/i18n";

/**
 * Daily Edition generator, extracted from the on-demand POST route
 * (src/app/api/ai/daily-edition/route.ts) so that BOTH the interactive
 * endpoint and the pre-generation cron (src/app/api/cron/daily-editions)
 * share ONE implementation.
 *
 * The only behavioural change from the original inline version is that
 * every context query is now explicitly scoped with .eq("user_id", userId).
 * The interactive route relied on Supabase RLS to scope reads to the
 * signed-in user, but the cron calls this with a SERVICE-ROLE client
 * (RLS bypassed), so the explicit user_id filter is required for
 * correctness under both callers. Adding it is a no-op under RLS.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupaClient = any;

export function localDateKey(d: Date, tz: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  });
  return fmt.format(d);
}

export type GenerateResult =
  | { ok: true; row: Record<string, unknown> }
  | { ok: false; error: string; status: number };

/**
 * Generate + upsert today's Daily Edition for one user in one language.
 * Callers own auth, per-user AI budget checks, and cache lookups; this
 * function always regenerates and upserts (keyed on
 * user_id,edition_date,language).
 */
export async function generateDailyEdition(opts: {
  supabase: SupaClient;
  userId: string;
  tz: string;
  language: LanguageCode;
}): Promise<GenerateResult> {
  const { supabase, userId, tz, language } = opts;

  const client = getAnthropic();
  if (!client) return { ok: false, error: "ai_disabled", status: 503 };

  const today = localDateKey(new Date(), tz);

  // Gather context. Local day boundaries mirror the original route.
  const startOfTodayLocal = new Date(`${today}T00:00:00`);
  const startOfTomorrowLocal = new Date(startOfTodayLocal);
  startOfTomorrowLocal.setDate(startOfTomorrowLocal.getDate() + 1);
  const endOfTomorrowLocal = new Date(startOfTomorrowLocal);
  endOfTomorrowLocal.setDate(endOfTomorrowLocal.getDate() + 1);

  const [todayTasks, tomorrowTasks, overdueTasks, recentDone, todayEvents] = await Promise.all([
    supabase.from("tasks").select("title,priority,due_at,project_id,is_completed,estimated_minutes")
      .eq("user_id", userId)
      .eq("is_completed", false)
      .lt("due_at", startOfTomorrowLocal.toISOString())
      .gte("due_at", startOfTodayLocal.toISOString())
      .order("priority", { ascending: false })
      .limit(20),
    supabase.from("tasks").select("title,priority,due_at,project_id")
      .eq("user_id", userId)
      .eq("is_completed", false)
      .gte("due_at", startOfTomorrowLocal.toISOString())
      .lt("due_at", endOfTomorrowLocal.toISOString())
      .limit(10),
    supabase.from("tasks").select("title,priority,due_at,project_id")
      .eq("user_id", userId)
      .eq("is_completed", false)
      .lt("due_at", startOfTodayLocal.toISOString())
      .order("due_at", { ascending: true })
      .limit(10),
    supabase.from("tasks").select("title,completed_at")
      .eq("user_id", userId)
      .eq("is_completed", true)
      .gte("completed_at", new Date(Date.now() - 3 * 24 * 3600_000).toISOString())
      .order("completed_at", { ascending: false })
      .limit(20),
    supabase.from("calendar_events").select("title,start_at,end_at,is_all_day,location,attendees_count")
      .eq("user_id", userId)
      .eq("cancelled", false)
      .gte("start_at", startOfTodayLocal.toISOString())
      .lt("start_at", startOfTomorrowLocal.toISOString())
      .order("start_at", { ascending: true })
      .limit(20),
  ]);

  const ctx = {
    date: today,
    weekday: new Date().toLocaleDateString("en-US", { weekday: "long", timeZone: tz }),
    today: todayTasks.data ?? [],
    tomorrow: tomorrowTasks.data ?? [],
    overdue: overdueTasks.data ?? [],
    recent_done: recentDone.data ?? [],
    calendar_events: todayEvents.data ?? [],
  };

  try {
    const res = await client.messages.create({
      model: MODELS.editorial,
      max_tokens: 700,
      system: dailyEditionSystem(language),
      messages: [{ role: "user", content: "CONTEXT (JSON):\n" + JSON.stringify(ctx, null, 2) }],
    });
    const content = res.content
      .map((c) => (c.type === "text" ? c.text : ""))
      .join("");
    const json = extractJson(content);
    const parsed = DailyEditionSchema.parse(json);
    await logAiCall(userId, "daily_edition", { model: res.model, status: 200, inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens });

    const row = {
      user_id: userId,
      edition_date: today,
      language,
      kicker: parsed.kicker,
      headline: parsed.headline,
      front_page: parsed.front_page,
      inside: parsed.inside,
      below_fold: parsed.below_fold,
      // Stash language in raw_json so the interactive cache lookup can
      // detect a language mismatch and regenerate.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      raw_json: { ...parsed, language } as any,
      model: MODELS.editorial,
    };
    // Upsert keyed by (user_id, edition_date, language) — the unique index.
    await supabase.from("daily_editions").upsert(row, {
      onConflict: "user_id,edition_date,language",
    });
    return { ok: true, row };
  } catch (e: any) {
    console.error("[ai]", "\n", e?.stack || e?.message || e);
    return { ok: false, error: e?.message ?? String(e), status: 502 };
  }
}
