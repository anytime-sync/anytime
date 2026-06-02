import { NextRequest } from "next/server";
import { z } from "zod";
import { resolveAiContext, jsonError, jsonOk } from "../_lib/ai-handler";
import { findTimeSystem } from "@/lib/ai/prompts";
import { extractJson } from "@/lib/ai/types";
import { logAiCall } from "@/lib/ai-rate-limit";
import { MODELS } from "@/lib/anthropic";

export const runtime = "nodejs";

const ReqSchema = z.object({
  task_id: z.string(),
  title: z.string().min(1).max(280),
  estimated_minutes: z.number().int().nullable().optional(),
});

const ResSchema = z.object({
  slots: z.array(z.object({
    start_at: z.string(),
    end_at: z.string(),
    label: z.string(),
    fit: z.enum(["best", "good", "backup"]),
  })).min(1).max(3),
});

export async function POST(req: NextRequest) {
  const resolved = await resolveAiContext(req, "find_time");
  if (!resolved.ok) return resolved.response;
  const { ctx } = resolved;

  let body: unknown;
  try { body = await req.json(); } catch { body = {}; }
  const parsed = ReqSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "bad_request", parsed.error.message);
  const { task_id, title, estimated_minutes } = parsed.data;

  const horizon = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: busyTasks } = await ctx.supabase
    .from("tasks")
    .select("title, start_at, due_at")
    .eq("user_id", ctx.userId)
    .not("start_at", "is", null)
    .lte("start_at", horizon);
  const busyBlock = (busyTasks ?? [])
    .filter((t: any) => t.start_at && t.due_at)
    .slice(0, 50)
    .map((t: any) => `${t.start_at} → ${t.due_at} (${t.title})`)
    .join("\n");

  const userMsg = [
    `NOW: ${new Date().toISOString()}`,
    `TASK: ${title}`,
    `DURATION: ${estimated_minutes ?? 30} minutes`,
    `BUSY_BLOCKS (next 7d):`,
    busyBlock || "(none)",
  ].join("\n");

  try {
    const res = await ctx.anthropic!.messages.create({
      model: MODELS.fast,
      max_tokens: 800,
      system: findTimeSystem(ctx.language),
      messages: [{ role: "user", content: userMsg }],
    });
    const content = res.content.map((c: any) => (c.type === "text" ? c.text : "")).join("");
    const json = extractJson(content);
    const out = ResSchema.parse(json);

    await logAiCall(ctx.userId, "find_time", { model: res.model, status: 200 });
    return jsonOk(out);
  } catch (e: any) {
    console.error("[v1/ai] find-time", e?.message ?? e);
    return jsonError(502, "find_time_failed", e?.message ?? String(e));
  }
}
