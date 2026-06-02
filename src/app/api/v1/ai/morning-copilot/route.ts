import { NextRequest } from "next/server";
import { z } from "zod";
import { resolveAiContext, jsonError, jsonOk } from "../_lib/ai-handler";
import { morningCopilotSystem } from "@/lib/ai/prompts";
import { MorningCopilotSchema, extractJson } from "@/lib/ai/types";
import { logAiCall } from "@/lib/ai-rate-limit";
import { MODELS } from "@/lib/anthropic";

export const runtime = "nodejs";

function localDateKey(d: Date, tz: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d);
}

/**
 * POST /api/v1/ai/morning-copilot
 * Body: { tz?: string, force?: boolean }
 * Returns: morning brief with suggested actions
 */
export async function POST(req: NextRequest) {
  const resolved = await resolveAiContext(req, "morning_copilot");
  if (!resolved.ok) return resolved.response;
  const { ctx } = resolved;

  let body: any;
  try { body = await req.json(); } catch { body = {}; }
  const tz: string = body.tz || "UTC";
  const force: boolean = !!body.force;
  const today = localDateKey(new Date(), tz);

  // Cache check
  if (!force) {
    const { data: cached } = await ctx.supabase
      .from("daily_copilot_log")
      .select("*")
      .eq("user_id", ctx.userId)
      .eq("local_date", today)
      .eq("language", ctx.language)
      .maybeSingle();
    if (cached && cached.status !== "dismissed") {
      return jsonOk(cached);
    }
  }

  const startOfTodayLocal = new Date(`${today}T00:00:00`);
  const startOfTomorrowLocal = new Date(startOfTodayLocal);
  startOfTomorrowLocal.setDate(startOfTomorrowLocal.getDate() + 1);
  const endOfTomorrowLocal = new Date(startOfTomorrowLocal);
  endOfTomorrowLocal.setDate(endOfTomorrowLocal.getDate() + 1);
  const yesterdayStart = new Date(Date.now() - 24 * 3600_000);

  const { data: prefs } = await ctx.supabase
    .from("user_preferences")
    .select("daily_capacity_minutes, energy_peak_start, energy_peak_end")
    .eq("user_id", ctx.userId)
    .maybeSingle();

  const [todayTasksResp, tomorrowCountResp, doneCountResp, reflectionResp, todayEventsResp] =
    await Promise.all([
      ctx.supabase
        .from("tasks")
        .select("id,title,priority,due_at,estimated_minutes,project_id,project:projects(name)")
        .eq("user_id", ctx.userId)
        .eq("is_completed", false)
        .lt("due_at", startOfTomorrowLocal.toISOString())
        .gte("due_at", startOfTodayLocal.toISOString())
        .order("priority", { ascending: false })
        .limit(25),
      ctx.supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", ctx.userId)
        .eq("is_completed", false)
        .gte("due_at", startOfTomorrowLocal.toISOString())
        .lt("due_at", endOfTomorrowLocal.toISOString()),
      ctx.supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", ctx.userId)
        .eq("is_completed", true)
        .gte("completed_at", yesterdayStart.toISOString()),
      ctx.supabase
        .from("daily_reflections")
        .select("headline, body, local_date")
        .eq("user_id", ctx.userId)
        .order("local_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      ctx.supabase
        .from("calendar_events")
        .select("title,start_at,end_at,is_all_day,location,attendees_count")
        .eq("user_id", ctx.userId)
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

  const context = {
    date: today,
    weekday: new Date().toLocaleDateString("en-US", { weekday: "long", timeZone: tz }),
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
      ? { headline: (reflectionResp.data as any).headline, body: (reflectionResp.data as any).body, local_date: (reflectionResp.data as any).local_date }
      : null,
    calendar_events: todayEventsResp.data ?? [],
  };

  const validIds = new Set(todayTasks.map((t: any) => t.id));

  try {
    const res = await ctx.anthropic!.messages.create({
      model: MODELS.editorial,
      max_tokens: 900,
      system: morningCopilotSystem(ctx.language),
      messages: [{ role: "user", content: "CONTEXT (JSON):\n" + JSON.stringify(context, null, 2) }],
    });
    const content = res.content.map((c: any) => (c.type === "text" ? c.text : "")).join("");
    const json = extractJson(content);
    const parsed = MorningCopilotSchema.parse(json);

    const cleanedActions = parsed.suggested_actions.filter((a: any) => validIds.has(a.task_id));
    const brief = { ...parsed, suggested_actions: cleanedActions };

    await logAiCall(ctx.userId, "morning_copilot", { model: res.model, status: 200 });

    const row = {
      user_id: ctx.userId,
      local_date: today,
      language: ctx.language,
      brief: brief as any,
      status: "open" as const,
      surfaced_at: new Date().toISOString(),
      responded_at: null as string | null,
    };
    const { data: upserted } = await ctx.supabase
      .from("daily_copilot_log")
      .upsert(row, { onConflict: "user_id,local_date,language" })
      .select()
      .maybeSingle();

    return jsonOk(upserted ?? row);
  } catch (e: any) {
    console.error("[v1/ai] morning-copilot", e?.message ?? e);
    return jsonError(502, "copilot_failed", e?.message ?? String(e));
  }
}
