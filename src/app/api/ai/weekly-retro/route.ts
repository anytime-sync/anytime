import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnthropic, MODELS } from "@/lib/anthropic";
import { weeklyRetroSystem } from "@/lib/ai/prompts";
import { WeeklyRetroSchema, extractJson } from "@/lib/ai/types";
import type { LanguageCode } from "@/lib/i18n";

export const runtime = "nodejs";

function isoWeek(d: Date, tz: string): { year: number; week: number; start: Date } {
  const localStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
  const local = new Date(`${localStr}T00:00:00`);
  const tmp = new Date(Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()));
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const year = tmp.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(((+tmp - +yearStart) / 86400000 + 1) / 7);
  const start = new Date(local);
  start.setDate(local.getDate() - (day - 1));
  return { year, week, start };
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const tz: string = body.tz || "UTC";
  const force: boolean = !!body.force;
  const target = body.target === "current" ? new Date() : new Date(Date.now() - 7 * 86400000);
  const { year, week, start } = isoWeek(target, tz);
  const startStr = start.toISOString().slice(0, 10);

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
      .maybeSingle();
    if (cached && (cached.raw_json as any)?.language === language) {
      return NextResponse.json(cached);
    }
  }

  const client = getAnthropic();
  if (!client) return NextResponse.json({ error: "ai_disabled" }, { status: 503 });

  const weekStart = new Date(start);
  const weekEnd = new Date(start);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const [shipped, slipped, openTasks] = await Promise.all([
    supabase.from("tasks").select("title,priority,project_id,completed_at")
      .eq("is_completed", true)
      .gte("completed_at", weekStart.toISOString())
      .lt("completed_at", weekEnd.toISOString())
      .order("completed_at", { ascending: true })
      .limit(60),
    supabase.from("tasks").select("title,priority,due_at,project_id")
      .eq("is_completed", false)
      .gte("due_at", weekStart.toISOString())
      .lt("due_at", weekEnd.toISOString())
      .limit(40),
    supabase.from("tasks").select("title,priority,due_at")
      .eq("is_completed", false)
      .lt("due_at", weekStart.toISOString())
      .limit(20),
  ]);

  const ctx = {
    week_start: startStr,
    iso_year: year,
    iso_week: week,
    shipped: shipped.data ?? [],
    slipped: slipped.data ?? [],
    older_open: openTasks.data ?? [],
  };

  try {
    const res = await client.messages.create({
      model: MODELS.editorial,
      max_tokens: 700,
      system: weeklyRetroSystem(language),
      messages: [{ role: "user", content: "CONTEXT (JSON):\n" + JSON.stringify(ctx, null, 2) }],
    });
    const content = res.content.map((c) => (c.type === "text" ? c.text : "")).join("");
    const json = extractJson(content);
    const parsed = WeeklyRetroSchema.parse(json);

    const row = {
      user_id: u.user.id,
      iso_year: year,
      iso_week: week,
      week_start: startStr,
      shipped: parsed.shipped,
      slipped: parsed.slipped,
      drop_list: parsed.drop_list,
      raw_json: { ...parsed, language } as any,
      model: MODELS.editorial,
    };
    await supabase.from("weekly_retros").upsert(row, {
      onConflict: "user_id,iso_year,iso_week",
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
