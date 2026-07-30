import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnthropic, MODELS } from "@/lib/anthropic";
import { checkAiBudget, logAiCall } from "@/lib/ai-rate-limit";
import { dailyEditionSystem } from "@/lib/ai/prompts";
import { DailyEditionSchema, extractJson } from "@/lib/ai/types";
import type { LanguageCode } from "@/lib/i18n";

export const runtime = "nodejs";

function localDateKey(d: Date, tz: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  });
  return fmt.format(d);
}

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

  // Cache lookup — only return cached if it was generated for the same
  // language. (We don't store language on daily_editions yet; treat
  // raw_json.language as the source of truth, fall back to English.)
  if (!force) {
    // Per-language cache hit: same user + day + language returns instantly.
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

  const client = getAnthropic();
  if (!client) return NextResponse.json({ error: "ai_disabled" }, { status: 503 });

  // Gather context.
  const startOfTodayLocal = new Date(`${today}T00:00:00`);
  const startOfTomorrowLocal = new Date(startOfTodayLocal);
  startOfTomorrowLocal.setDate(startOfTomorrowLocal.getDate() + 1);
  const endOfTomorrowLocal = new Date(startOfTomorrowLocal);
  endOfTomorrowLocal.setDate(endOfTomorrowLocal.getDate() + 1);

  const [todayTasks, tomorrowTasks, overdueTasks, recentDone, todayEvents] = await Promise.all([
    supabase.from("tasks").select("title,priority,due_at,project_id,is_completed,estimated_minutes")
      .eq("is_completed", false)
      .lt("due_at", startOfTomorrowLocal.toISOString())
      .gte("due_at", startOfTodayLocal.toISOString())
      .order("priority", { ascending: false })
      .limit(20),
    supabase.from("tasks").select("title,priority,due_at,project_id")
      .eq("is_completed", false)
      .gte("due_at", startOfTomorrowLocal.toISOString())
      .lt("due_at", endOfTomorrowLocal.toISOString())
      .limit(10),
    supabase.from("tasks").select("title,priority,due_at,project_id")
      .eq("is_completed", false)
      .lt("due_at", startOfTodayLocal.toISOString())
      .order("due_at", { ascending: true })
      .limit(10),
    supabase.from("tasks").select("title,completed_at")
      .eq("is_completed", true)
      .gte("completed_at", new Date(Date.now() - 3 * 24 * 3600_000).toISOString())
      .order("completed_at", { ascending: false })
      .limit(20),
    // Round F v4.5: include today's Google Calendar events in the AI
    // context so the daily edition can plan around real meetings, not
    // just tasks.
    supabase.from("calendar_events").select("title,start_at,end_at,is_all_day,location,attendees_count")
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
    // Round F v4.5: meetings/events from Google Calendar — same calendar
    // day as `today`. The AI uses these to know which hours are blocked
    // by real meetings vs. flexible tasks.
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
    await logAiCall(u.user.id, "daily_edition", { model: res.model, status: 200, inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens });

    const row = {
      user_id: u.user.id,
      edition_date: today,
      language,
      kicker: parsed.kicker,
      headline: parsed.headline,
      front_page: parsed.front_page,
      inside: parsed.inside,
      below_fold: parsed.below_fold,
      // Stash language in raw_json so the cache lookup above can detect
      // language mismatch and regenerate.
      raw_json: { ...parsed, language } as any,
      model: MODELS.editorial,
    };
    // Upsert keyed by (user_id, edition_date, language) — the new unique
    // index — so each language gets its own cached row.
    await supabase.from("daily_editions").upsert(row, {
      onConflict: "user_id,edition_date,language",
    });
    return NextResponse.json(row);
  } catch (e: any) {
    console.error("[ai]", "\n", e?.stack || e?.message || e);
    return NextResponse.json(
      { error: "edition_failed", detail: e?.message ?? String(e) },
      { status: 502 }
    );
  }
}
