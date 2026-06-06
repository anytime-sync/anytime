import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnthropic, MODELS } from "@/lib/anthropic";
import { checkAiBudget, logAiCall } from "@/lib/ai-rate-limit";
import { morningCopilotSystem } from "@/lib/ai/prompts";
import { MorningCopilotSchema, extractJson } from "@/lib/ai/types";
import type { LanguageCode } from "@/lib/i18n";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Morning Co-pilot — Round E. Once-a-day proactive brief, cached per
 * (user, local_date, language) just like Daily Edition. Returns the
 * row from `daily_copilot_log`. The companion /respond route updates
 * the row's status in response to the user pressing Apply / Snooze /
 * Dismiss.
 */

function localDateKey(d: Date, tz: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d);
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const tz: string = body.tz || "UTC";
  const force: boolean = !!body.force;
  const today = localDateKey(new Date(), tz);

  // Resolve the user's preferred language. Cache key includes language
  // so a switch regenerates the brief in the new tongue.
  const { data: prefs } = await supabase
    .from("user_preferences")
    .select(
      "language, daily_capacity_minutes, energy_peak_start, energy_peak_end"
    )
    .eq("user_id", u.user.id)
    .maybeSingle();
  const language = (prefs?.language ?? "en") as LanguageCode;

  // Cache lookup. We always serve the cached row when it exists and the
  // user hasn't dismissed it — even if status='applied' or 'snoozed', so
  // the UI can render the after-state. `force` bypasses cache.
  if (!force) {
    const { data: cached } = await supabase
      .from("daily_copilot_log")
      .select("*")
      .eq("user_id", u.user.id)
      .eq("local_date", today)
      .eq("language", language)
      .maybeSingle();
    if (cached && cached.status !== "dismissed") {
      return NextResponse.json(cached);
    }
  }

  // Per-user daily AI budget check.
  const budget = await checkAiBudget(u.user.id, "morning_copilot");
  if (!budget.ok) {
    return NextResponse.json(
      { error: "rate_limited", used: budget.used, limit: budget.limit },
      { status: 429, headers: { "Retry-After": String(budget.retryAfter) } }
    );
  }

  const client = getAnthropic();
  if (!client) {
    return NextResponse.json({ error: "ai_disabled" }, { status: 503 });
  }

  // -- Gather context --------------------------------------------------
  const startOfTodayLocal = new Date(`${today}T00:00:00`);
  const startOfTomorrowLocal = new Date(startOfTodayLocal);
  startOfTomorrowLocal.setDate(startOfTomorrowLocal.getDate() + 1);
  const endOfTomorrowLocal = new Date(startOfTomorrowLocal);
  endOfTomorrowLocal.setDate(endOfTomorrowLocal.getDate() + 1);
  const yesterdayStart = new Date(Date.now() - 24 * 3600_000);

  const [todayTasksResp, tomorrowCountResp, doneCountResp, reflectionResp, todayEventsResp] =
    await Promise.all([
      supabase
        .from("tasks")
        .select(
          "id,title,priority,due_at,estimated_minutes,project_id,project:projects(name)"
        )
        .eq("user_id", u.user.id)
        .eq("is_completed", false)
        .lt("due_at", startOfTomorrowLocal.toISOString())
        .gte("due_at", startOfTodayLocal.toISOString())
        .order("priority", { ascending: false })
        .limit(25),
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", u.user.id)
        .eq("is_completed", false)
        .gte("due_at", startOfTomorrowLocal.toISOString())
        .lt("due_at", endOfTomorrowLocal.toISOString()),
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", u.user.id)
        .eq("is_completed", true)
        .gte("completed_at", yesterdayStart.toISOString()),
      supabase
        .from("daily_reflections")
        .select("headline, body, local_date")
        .eq("user_id", u.user.id)
        .order("local_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      // Round F v4.5: today's Google Calendar events so the co-pilot
      // knows which hours are blocked by real meetings vs. movable
      // task slots.
      supabase
        .from("calendar_events")
        .select("title,start_at,end_at,is_all_day,location,attendees_count")
        .eq("user_id", u.user.id)
        .eq("cancelled", false)
        .gte("start_at", startOfTodayLocal.toISOString())
        .lt("start_at", startOfTomorrowLocal.toISOString())
        .order("start_at", { ascending: true })
        .limit(20),
    ]);

  const todayTasks = (todayTasksResp.data ?? []).map((row: any) => ({
    id: row.id,
    title: row.title,
    priority: row.priority,
    due_at: row.due_at,
    estimated_minutes: row.estimated_minutes,
    project: row.project?.name ?? null,
  }));

  const ctx = {
    date: today,
    weekday: new Date().toLocaleDateString("en-US", {
      weekday: "long",
      timeZone: tz,
    }),
    timezone: tz,
    capacity: {
      daily_capacity_minutes: prefs?.daily_capacity_minutes ?? null,
      energy_peak_start: prefs?.energy_peak_start ?? null,
      energy_peak_end: prefs?.energy_peak_end ?? null,
    },
    today_open_tasks: todayTasks,
    tomorrow_open_count: tomorrowCountResp.count ?? 0,
    yesterday_completed_count: doneCountResp.count ?? 0,
    yesterday_reflection: reflectionResp.data
      ? {
          headline: (reflectionResp.data as any).headline,
          body: (reflectionResp.data as any).body,
          local_date: (reflectionResp.data as any).local_date,
        }
      : null,
    // Round F v4.5: real meetings the user has on the calendar today.
    // The co-pilot uses these to schedule around blocked hours.
    calendar_events: todayEventsResp.data ?? [],
  };

  // Collect valid task ids so we can validate the model didn't invent any.
  const validIds = new Set(todayTasks.map((t) => t.id));

  try {
    const res = await client.messages.create({
      model: MODELS.editorial,
      max_tokens: 900,
      system: morningCopilotSystem(language),
      messages: [
        {
          role: "user",
          content: "CONTEXT (JSON):\n" + JSON.stringify(ctx, null, 2),
        },
      ],
    });
    const content = res.content
      .map((c) => (c.type === "text" ? c.text : ""))
      .join("");
    const json = extractJson(content);
    const parsed = MorningCopilotSchema.parse(json);

    // Drop any suggested action whose task_id the model hallucinated.
    const cleanedActions = parsed.suggested_actions.filter((a) =>
      validIds.has(a.task_id)
    );
    const brief = { ...parsed, suggested_actions: cleanedActions };

    await logAiCall(u.user.id, "morning_copilot", {
      model: res.model,
      status: 200,
      inputTokens: res.usage.input_tokens,
      outputTokens: res.usage.output_tokens,
    });

    const row = {
      user_id: u.user.id,
      local_date: today,
      language,
      brief: brief as any,
      status: "open" as const,
      surfaced_at: new Date().toISOString(),
      responded_at: null as string | null,
    };
    const { data: upserted, error: upErr } = await supabase
      .from("daily_copilot_log")
      .upsert(row, { onConflict: "user_id,local_date,language" })
      .select()
      .maybeSingle();
    if (upErr) {
      console.error("[ai] morning-copilot upsert", upErr);
      return NextResponse.json(row);
    }
    return NextResponse.json(upserted ?? row);
  } catch (e: any) {
    console.error(
      "[ai] morning-copilot",
      "\n",
      e?.stack || e?.message || e
    );
    return NextResponse.json(
      { error: "copilot_failed", detail: e?.message ?? String(e) },
      { status: 502 }
    );
  }
}
