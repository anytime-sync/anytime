import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkAiBudget } from "@/lib/ai-rate-limit";
import { generateDailyEdition, localDateKey } from "@/lib/ai/daily-edition";
import type { LanguageCode } from "@/lib/i18n";

export const runtime = "nodejs";

/**
 * On-demand Daily Edition endpoint. Auth + per-user AI budget + per-language
 * caching live here; the actual generation is shared with the pre-generation
 * cron via generateDailyEdition() in @/lib/ai/daily-edition.
 */

/**
 * Hand-crafted first-run edition. A brand-new account has no tasks yet, so
 * there is nothing for the AI to summarise — this shows what the Daily Edition
 * *is* in the product's editorial voice, with zero AI spend, and is replaced
 * by a real generated edition the moment the user adds tasks and regenerates
 * (or the next day rolls over). English for now; localisation can follow.
 */
function welcomeEdition(_language: LanguageCode) {
  return {
    kicker: "First Light · Your Daily Edition",
    headline: "Welcome — your mornings just got quieter",
    front_page:
      "This is your Daily Edition: one calm briefing that pulls today's tasks, calendar, and habits into a single read. Add your first task or connect your calendar and tomorrow's edition writes itself.",
    inside:
      "Most people start by dropping in three things they want to move today. First Light sorts them by priority and energy, so you open the app already knowing where to begin — no blank page, no planning tax.",
    below_fold:
      "Tap the refresh icon any time to regenerate this edition once you've added a few tasks.",
  };
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Per-user daily AI budget check (Anthropic cost guard).
  const __budget = await checkAiBudget(u.user.id, "daily_edition");
  if (!__budget.ok) {
    return NextResponse.json(
      { error: "rate_limited", used: __budget.used, limit: __budget.limit },
      { status: 429, headers: { "Retry-After": String(__budget.retryAfter) } }
    );
  }

  const body = await req.json().catch(() => ({}));
  const tz: string = body.tz || "UTC";
  const force: boolean = !!body.force;
  const today = localDateKey(new Date(), tz);

  // Read user prefs (language). Cache key includes language so switching
  // language regenerates the brief instead of serving stale English.
  const { data: prefs } = await supabase
    .from("user_preferences")
    .select("language")
    .eq("user_id", u.user.id)
    .maybeSingle();
  const language = (prefs?.language ?? "en") as LanguageCode;

  // Per-language cache hit: same user + day + language returns instantly.
  if (!force) {
    const { data: cached } = await supabase
      .from("daily_editions")
      .select("*")
      .eq("user_id", u.user.id)
      .eq("edition_date", today)
      .eq("language", language)
      .maybeSingle();
    if (cached) {
      return NextResponse.json(cached);
    }
  }

  // First-run welcome edition. A brand-new account (no editions ever, no tasks
  // yet) can't get a meaningful AI briefing — there's nothing to summarise.
  // Serve a hand-crafted welcome edition so the value of the Daily Edition is
  // visible in under 60s with ZERO AI spend. It's cached like any other row,
  // so it stays put until they add tasks and hit regenerate (force) or the
  // next day rolls over.
  if (!force) {
    const [editions, tasks] = await Promise.all([
      supabase
        .from("daily_editions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", u.user.id),
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", u.user.id),
    ]);
    if ((editions.count ?? 0) === 0 && (tasks.count ?? 0) === 0) {
      const welcome = welcomeEdition(language);
      const row = {
        user_id: u.user.id,
        edition_date: today,
        language,
        ...welcome,
        raw_json: { ...welcome, language, seed: "welcome" } as any,
        model: "welcome-seed",
      };
      // Upsert keyed by (user_id, edition_date, language) so it slots into the
      // same cache the returning-user lookup above reads from.
      await supabase.from("daily_editions").upsert(row, {
        onConflict: "user_id,edition_date,language",
      });
      return NextResponse.json(row);
    }
  }

  const result = await generateDailyEdition({
    supabase,
    userId: u.user.id,
    tz,
    language,
  });
  if (!result.ok) {
    const error = result.error === "ai_disabled" ? "ai_disabled" : "edition_failed";
    return NextResponse.json(
      { error, detail: result.error },
      { status: result.status }
    );
  }
  return NextResponse.json(result.row);
}
