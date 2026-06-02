import { NextRequest } from "next/server";
import { z } from "zod";
import { resolveAiContext, jsonError, jsonOk } from "../_lib/ai-handler";
import { planDaySystem } from "@/lib/ai/prompts";
import { extractJson } from "@/lib/ai/types";
import { logAiCall } from "@/lib/ai-rate-limit";
import { MODELS } from "@/lib/anthropic";

export const runtime = "nodejs";

const ReqSchema = z.object({
  tasks: z.array(z.object({
    id: z.string(),
    title: z.string(),
    due_at: z.string().nullable().optional(),
    priority: z.number().int().min(0).max(5),
    project: z.string().nullable().optional(),
  })).min(1).max(40),
});

const ResSchema = z.object({
  suggestions: z.array(z.object({
    id: z.string(),
    quadrant: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
    suggested_priority: z.union([z.literal(0), z.literal(1), z.literal(3), z.literal(5)]),
    reason: z.string(),
  })),
  notes: z.string().optional(),
});

function isTimeLocked(x: { title: string }): boolean {
  const re = /\b(meeting|meet|call|interview|appointment|appt|anniversary|birthday|wedding|ceremony|dinner reservation|flight|doctor|dentist|hearing|exam|consultation|conference|standup|stand-up|sync|1:1|one-on-one|catch-up|catchup|review with|check-in)\b/i;
  const time = /\b(at\s+\d|\d{1,2}\s*(am|pm|AM|PM)|\d{1,2}:\d{2})\b/;
  return re.test(x.title) || time.test(x.title);
}

/**
 * POST /api/v1/ai/plan-day
 * Body: { tasks: [{ id, title, due_at?, priority, project? }] }
 * Returns: { suggestions: [...], notes: string }
 */
export async function POST(req: NextRequest) {
  const resolved = await resolveAiContext(req, "plan_day");
  if (!resolved.ok) return resolved.response;
  const { ctx } = resolved;

  let body: unknown;
  try { body = await req.json(); } catch { body = {}; }
  const parsed = ReqSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "bad_request", parsed.error.message);

  const { tasks } = parsed.data;
  const flexibleTasks = tasks.filter((t) => !isTimeLocked(t));

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);

  const { data: events } = await ctx.supabase
    .from("calendar_events")
    .select("title,start_at,end_at,is_all_day,location,attendees_count")
    .eq("user_id", ctx.userId)
    .eq("cancelled", false)
    .gte("start_at", startOfToday.toISOString())
    .lt("start_at", endOfToday.toISOString())
    .order("start_at", { ascending: true })
    .limit(20);

  const eventBlock = (events ?? [])
    .map((e: any) => {
      const time = e.is_all_day ? "all-day"
        : e.start_at && e.end_at
          ? `${new Date(e.start_at).toISOString().slice(11, 16)}-${new Date(e.end_at).toISOString().slice(11, 16)}`
          : "";
      return [e.title || "(untitled)", time && `· ${time}`, e.location && `· @${e.location}`].filter(Boolean).join(" ");
    })
    .join("\n");

  const taskBlock = flexibleTasks
    .map((t) => [`[${t.id}]`, t.title, t.due_at ? `· due ${t.due_at}` : "· undated", `· p${t.priority}`, t.project ? `· ${t.project}` : ""].filter(Boolean).join(" "))
    .join("\n");

  const userMsg = [
    `NOW: ${now.toISOString()}`,
    `WORKING_HORIZON: today (~12 hours)`,
    eventBlock ? `CALENDAR EVENTS TODAY (${(events ?? []).length}):\n${eventBlock}` : "CALENDAR EVENTS TODAY: (none)",
    `TASKS (${tasks.length}):`,
    taskBlock,
  ].join("\n");

  try {
    const res = await ctx.anthropic!.messages.create({
      model: MODELS.fast,
      max_tokens: 1500,
      system: planDaySystem(ctx.language),
      messages: [{ role: "user", content: userMsg }],
    });
    const content = res.content.map((c: any) => (c.type === "text" ? c.text : "")).join("");
    const json = extractJson(content);
    const out = ResSchema.parse(json);

    const known = new Set(flexibleTasks.map((t) => t.id));
    const filtered = out.suggestions.filter((s) => known.has(s.id));

    await logAiCall(ctx.userId, "plan_day", { model: res.model, status: 200 });
    return jsonOk({ suggestions: filtered, notes: out.notes ?? "" });
  } catch (e: any) {
    console.error("[v1/ai] plan-day", e?.message ?? e);
    return jsonError(502, "plan_day_failed", e?.message ?? String(e));
  }
}
