import { calendarDate, dayWindow } from "@/lib/day-window";
import { safeTimezone } from "@/lib/ai/tz";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnthropic, MODELS } from "@/lib/anthropic";
import { checkAiBudget, logAiCall } from "@/lib/ai-rate-limit";
import { weeklyRetroSystem } from "@/lib/ai/prompts";
import { WeeklyRetroSchema, extractJson } from "@/lib/ai/types";
import type { LanguageCode } from "@/lib/i18n";

export const runtime = "nodejs";

function isoWeek(d: Date, tz: string): { year: number; week: number; start: Date } {
  const localDate = calendarDate(d,tz), local = new Date(localDate);
  const dow=local.getUTCDay() || 7;
  const thursday=new Date(+local);thursday.setUTCDate(thursday.getUTCDate()+4-dow);
  const year=thursday.getUTCFullYear();
  const week=Math.ceil(((+thursday-Date.UTC(year,0,1))/86400000+1)/7);
  local.setUTCDate(local.getUTCDate()-(dow-1));
  return {year,week,start:dayWindow(local.toISOString().slice(0,10),tz).start};
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Per-user daily AI budget check (Anthropic cost guard).
  const __budget = await checkAiBudget(u.user.id, "weekly_retro");
  if (!__budget.ok) {
    return NextResponse.json(
      { error: "rate_limited", used: __budget.used, limit: __budget.limit },
      { status: 429, headers: { "Retry-After": String(__budget.retryAfter) } }
    );
  }

  const body = await req.json().catch(() => ({}));
  const tz = safeTimezone(body?.tz);
  const force: boolean = !!body?.force;
  const today = calendarDate(new Date(),tz);
  const targetDate = body?.target === "current" ? today : new Date(Date.parse(today)-7*86400000).toISOString().slice(0,10);
  const target = dayWindow(targetDate,tz).start;
  const { year, week, start } = isoWeek(target, tz);
  const startStr = calendarDate(start,tz);

  const { data: prefs } = await supabase
    .from("user_preferences")
    .select("language")
    .eq("user_id", u.user.id)
    .maybeSingle();
  const language = (prefs?.language ?? "en") as LanguageCode;

  if (!force) {
    const { data: cached } = await supabase
      .from("weekly_retros")
      .select("*")
      .eq("user_id", u.user.id)
      .eq("iso_year", year)
      .eq("iso_week", week)
      .eq("language", language)
      .maybeSingle();
    if (cached && (cached.raw_json as any)?.language === language && (cached.raw_json as any)?.brief_version === 2) {
      return NextResponse.json(cached);
    }
  }

  const client = getAnthropic();
  if (!client) return NextResponse.json({ error: "ai_disabled" }, { status: 503 });

  const weekStart = new Date(start);
  const weekEnd = dayWindow(new Date(Date.parse(startStr)+7*86400000).toISOString().slice(0,10),tz).start;

  // Smarter-retro: fetch last week's saved retro so the model can
  // pick up on continuing themes. ISO-week math handles year wrap.
  const lastWeekDate = dayWindow(new Date(Date.parse(startStr)-7*86400000).toISOString().slice(0,10),tz).start;
  const lastWeekIso = isoWeek(lastWeekDate, tz);

  const [shipped, slipped, openTasks, lastWeekRetro, weekEvents] = await Promise.all([
    supabase.from("tasks").select("title,priority,project_id,completed_at")
      .eq("is_completed", true)
      .eq("user_id",u.user.id).neq("status","archived")
      .gte("completed_at", weekStart.toISOString())
      .lt("completed_at", weekEnd.toISOString())
      .order("completed_at", { ascending: true })
      .limit(60),
    supabase.from("tasks").select("title,priority,due_at,project_id")
      .eq("is_completed", false)
      .eq("user_id",u.user.id).neq("status","archived")
      .gte("due_at", weekStart.toISOString())
      .lt("due_at", weekEnd.toISOString())
      .limit(40),
    supabase.from("tasks").select("title,priority,due_at")
      .eq("is_completed", false)
      .eq("user_id",u.user.id).neq("status","archived")
      .lt("due_at", weekStart.toISOString())
      .limit(20),
    supabase.from("weekly_retros")
      .select("shipped,slipped,drop_list,raw_json")
      .eq("user_id", u.user.id)
      .eq("iso_year", lastWeekIso.year)
      .eq("iso_week", lastWeekIso.week)
      .eq("language", language)
      .maybeSingle(),
    // Round F v4.5: include the week's Google Calendar events so the
    // retro can speak about meetings that consumed time, not only
    // tasks shipped/slipped.
    supabase.from("calendar_events")
      .select("title,start_at,end_at,is_all_day,location,attendees_count")
      .eq("user_id", u.user.id)
      .eq("cancelled", false)
      .gt("end_at", weekStart.toISOString())
      .lt("start_at", weekEnd.toISOString())
      .order("start_at", { ascending: true })
      .limit(60),
  ]);

  if ([shipped,slipped,openTasks,weekEvents].some(r=>r.error)) return NextResponse.json({error:"Source records unavailable; no review was generated."},{status:503});
  const lw = lastWeekRetro.data;
  const lastWeekSnippet = lw
    ? {
        shipped: lw.shipped,
        slipped: lw.slipped,
        drop_list: lw.drop_list,
        themes: (lw.raw_json as any)?.themes,
        next_week_plan: (lw.raw_json as any)?.next_week_plan,
      }
    : null;

  const ctx = {
    week_start: startStr,
    iso_year: year,
    iso_week: week,
    shipped: shipped.data ?? [],
    slipped: slipped.data ?? [],
    older_open: openTasks.data ?? [],
    last_week: lastWeekSnippet,
    // Round F v4.5: meetings that took place during this ISO week.
    calendar_events: weekEvents.data ?? [],
  };

  try {
    const res = await client.messages.create({
      model: MODELS.fast,
      max_tokens: 700,
      system: weeklyRetroSystem(language),
      messages: [{ role: "user", content: "CONTEXT (JSON):\n" + JSON.stringify(ctx, null, 2) }],
    });
    const content = res.content.map((c) => (c.type === "text" ? c.text : "")).join("");
    const json = extractJson(content);
    const parsed = WeeklyRetroSchema.parse(json);
    await logAiCall(u.user.id, "weekly_retro", { model: res.model, status: 200, inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens });

    const row = {
      user_id: u.user.id,
      iso_year: year,
      iso_week: week,
      language,
      week_start: startStr,
      shipped: parsed.shipped,
      slipped: parsed.slipped,
      drop_list: parsed.drop_list,
      // Smarter-retro additions live in raw_json (no schema migration).
      raw_json: {
        ...parsed,
        brief_version: 2,
        themes: parsed.themes ?? "",
        next_week_plan: parsed.next_week_plan ?? "",
        language,
      } as any,
      model: MODELS.fast,
    };
    // Per-language cache: each language has its own cached retro row.
    await supabase.from("weekly_retros").upsert(row, {
      onConflict: "user_id,iso_year,iso_week,language",
    });
    return NextResponse.json(row);
  } catch (e: any) {
    console.error("[ai]", "\n", e?.stack || e?.message || e);
    return NextResponse.json(
      { error: "retro_failed", detail: e?.message ?? String(e) },
      { status: 502 }
    );
  }
}
