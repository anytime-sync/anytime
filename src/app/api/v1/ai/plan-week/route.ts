import { NextRequest } from "next/server";
import { z } from "zod";
import { resolveAiContext, jsonError, jsonOk } from "../_lib/ai-handler";
import { planWeekSystem } from "@/lib/ai/prompts";
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
  })).min(1).max(30),
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

/**
 * POST /api/v1/ai/plan-week
 * Body: { tasks: [{ id, title, due_at?, priority, project? }] }
 * Returns: { suggestions: [...], notes: string }
 */
export async function POST(req: NextRequest) {
  const resolved = await resolveAiContext(req, "plan_week");
  if (!resolved.ok) return resolved.response;
  const { ctx } = resolved;

  let body: unknown;
  try { body = await req.json(); } catch { body = {}; }
  const parsed = ReqSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "bad_request", parsed.error.message);

  const { tasks } = parsed.data;
  const taskBlock = tasks
    .map((t) => [`[${t.id}]`, t.title, t.due_at ? `· due ${t.due_at}` : "· undated", `· p${t.priority}`, t.project ? `· ${t.project}` : ""].filter(Boolean).join(" "))
    .join("\n");

  const userMsg = [
    `NOW: ${new Date().toISOString()}`,
    `WORKING_HORIZON: next 7 days`,
    `TASKS (${tasks.length}):`,
    taskBlock,
  ].join("\n");

  try {
    const res = await ctx.anthropic!.messages.create({
      model: MODELS.fast,
      max_tokens: 1500,
      system: planWeekSystem(ctx.language),
      messages: [{ role: "user", content: userMsg }],
    });
    const content = res.content.map((c: any) => (c.type === "text" ? c.text : "")).join("");
    const json = extractJson(content);
    const out = ResSchema.parse(json);

    const known = new Set(tasks.map((t) => t.id));
    out.suggestions = out.suggestions.filter((s) => known.has(s.id));

    await logAiCall(ctx.userId, "plan_week", { model: res.model, status: 200 });
    return jsonOk({ suggestions: out.suggestions, notes: out.notes ?? "" });
  } catch (e: any) {
    console.error("[v1/ai] plan-week", e?.message ?? e);
    return jsonError(502, "plan_week_failed", e?.message ?? String(e));
  }
}
