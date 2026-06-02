import { NextRequest } from "next/server";
import { z } from "zod";
import { resolveAiContext, jsonError, jsonOk } from "../_lib/ai-handler";
import { procrastinationSystem } from "@/lib/ai/prompts";
import { extractJson } from "@/lib/ai/types";
import { logAiCall } from "@/lib/ai-rate-limit";
import { MODELS } from "@/lib/anthropic";

export const runtime = "nodejs";

const ResSchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    verdict: z.enum(["drop", "break-down", "schedule"]),
    reason: z.string(),
    subtasks: z.array(z.string()).default([]),
  })),
  summary: z.string().default(""),
});

export async function POST(req: NextRequest) {
  const resolved = await resolveAiContext(req, "procrastination");
  if (!resolved.ok) return resolved.response;
  const { ctx } = resolved;

  const fortnightAgo = new Date(Date.now() - 14 * 86400_000).toISOString();
  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
  const { data: candidates } = await ctx.supabase
    .from("tasks")
    .select("id, title, created_at, updated_at, priority, due_at")
    .eq("user_id", ctx.userId)
    .eq("is_completed", false)
    .lte("created_at", fortnightAgo)
    .lte("updated_at", weekAgo)
    .order("updated_at", { ascending: true })
    .limit(40);

  if (!candidates || candidates.length === 0) {
    return jsonOk({ items: [], summary: "Nothing stuck. Clean list." });
  }

  const now = Date.now();
  const block = candidates.map((t: any) => {
    const daysOpen = Math.floor((now - new Date(t.created_at!).getTime()) / 86400_000);
    const lastTouched = Math.floor((now - new Date(t.updated_at!).getTime()) / 86400_000);
    return `[${t.id}] ${t.title} · open ${daysOpen}d · touched ${lastTouched}d ago · p${t.priority}`;
  }).join("\n");

  try {
    const res = await ctx.anthropic!.messages.create({
      model: MODELS.fast,
      max_tokens: 1500,
      system: procrastinationSystem(ctx.language),
      messages: [{ role: "user", content: `NOW: ${new Date().toISOString()}\nSTUCK CANDIDATES (${candidates.length}):\n${block}` }],
    });
    const content = res.content.map((c: any) => (c.type === "text" ? c.text : "")).join("");
    const json = extractJson(content);
    const out = ResSchema.parse(json);

    const known = new Set(candidates.map((t: any) => t.id));
    out.items = out.items.filter((it) => known.has(it.id));

    await logAiCall(ctx.userId, "procrastination", { model: res.model, status: 200 });
    return jsonOk(out);
  } catch (e: any) {
    console.error("[v1/ai] procrastination", e?.message ?? e);
    return jsonError(502, "procrastination_failed", e?.message ?? String(e));
  }
}
