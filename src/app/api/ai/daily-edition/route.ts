import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnthropic, MODELS } from "@/lib/anthropic";
import { DAILY_EDITION_SYSTEM } from "@/lib/ai/prompts";
import { DailyEditionSchema, extractJson } from "@/lib/ai/types";

export const runtime = "nodejs";

function localDateKey(d: Date, tz: string): string {
  // Returns YYYY-MM-DD in the user's local tz.
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  });
  return fmt.format(d);
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const tz: string = body.tz || "UTC";
  const force: boolean = !!body.force;
  const today = localDateKey(new Date(), tz);

  // Cached?
  if (!force) {
    const { data: cached } = await supabase
      .from("daily_editions")
      .select("*")
      .eq("user_id", u.user.id)
      .eq("edition_date", today)
      .maybeSingle();
    if (cached) return NextResponse.json(cached);
  }

  const client = getAnthropic();
  if (!client) return NextResponse.json({ error: "ai_disabled" }, { status: 503 });

  // Gather context.
  const startOfTodayLocal = new Date(`${today}T00:00:00`);
  const startOfTomorrowLocal = new Date(startOfTodayLocal);
  startOfTomorrowLocal.setDate(startOfTomorrowLocal.getDate() + 1);
  const endOfTomorrowLocal = new Date(startOfTomorrowLocal);
  endOfTomorrowLocal.setDate(endOfTomorrowLocal.getDate() + 1);

  const [todayTasks, tomorrowTasks, overdueTasks, recentDone] = await Promise.all([
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
  ]);

  const ctx = {
    date: today,
    weekday: new Date().toLocaleDateString("en-US", { weekday: "long", timeZone: tz }),
    today: todayTasks.data ?? [],
    tomorrow: tomorrowTasks.data ?? [],
    overdue: overdueTasks.data ?? [],
    recent_done: recentDone.data ?? [],
  };

  try {
    const res = await client.messages.create({
      model: MODELS.editorial,
      max_tokens: 700,
      system: DAILY_EDITION_SYSTEM,
      messages: [{ role: "user", content: "CONTEXT (JSON):\n" + JSON.stringify(ctx, null, 2) }],
    });
    const content = res.content
      .map((c) => (c.type === "text" ? c.text : ""))
      .join("");
    const json = extractJson(content);
    const parsed = DailyEditionSchema.parse(json);

    const row = {
      user_id: u.user.id,
      edition_date: today,
      kicker: parsed.kicker,
      headline: parsed.headline,
      front_page: parsed.front_page,
      inside: parsed.inside,
      below_fold: parsed.below_fold,
      raw_json: parsed as any,
      model: MODELS.editorial,
    };
    await supabase.from("daily_editions").upsert(row, {
      onConflict: "user_id,edition_date",
    });
    return NextResponse.json(row);
  } catch (e: any) {
    return NextResponse.json(
      { error: "edition_failed", detail: e?.message ?? String(e) },
      { status: 502 }
    );
  }
}
