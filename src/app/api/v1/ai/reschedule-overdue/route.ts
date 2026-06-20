import { NextRequest } from "next/server";
import { z } from "zod";
import { resolveAiContext, jsonError, jsonOk } from "../_lib/ai-handler";
import { extractJson } from "@/lib/ai/types";
import { logAiCall } from "@/lib/ai-rate-limit";
import { MODELS } from "@/lib/anthropic";

export const runtime = "nodejs";

/** Normalize AI-returned due_at to 09:00 Taipei (01:00 UTC). */
function normalizeToMorning(isoStr: string | null): string | null {
  if (!isoStr) return null;
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  d.setUTCHours(1, 0, 0, 0);
  return d.toISOString();
}

const ResSchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    new_due_at: z.string(),
    reason: z.string(),
  })),
});

/**
 * POST /api/v1/ai/reschedule-overdue
 * No body required — automatically finds overdue tasks and suggests new dates.
 * Returns: { items: [{ id, new_due_at, reason }] }
 */
export async function POST(req: NextRequest) {
  const resolved = await resolveAiContext(req, "reschedule_task");
  if (!resolved.ok) return resolved.response;
  const { ctx } = resolved;

  const now = new Date();
  const { data: overdue } = await ctx.supabase
    .from("tasks")
    .select("id, title, priority, due_at, created_at")
    .eq("user_id", ctx.userId)
    .eq("is_completed", false)
    .not("due_at", "is", null)
    .lt("due_at", now.toISOString())
    .order("due_at", { ascending: true })
    .limit(20);

  if (!overdue || overdue.length === 0) {
    return jsonOk({ items: [], message: "No overdue tasks." });
  }

  const block = overdue.map((t: any) => {
    const daysOverdue = Math.floor((now.getTime() - new Date(t.due_at!).getTime()) / 86400_000);
    return `[${t.id}] ${t.title} · p${t.priority} · ${daysOverdue}d overdue · was due ${t.due_at}`;
  }).join("\n");

  const systemPrompt = `You reschedule overdue tasks. Given tasks that are past due, suggest realistic new due dates.
Rules:
- Spread tasks across the next 7 days — don't pile everything on tomorrow
- Higher priority = sooner. Lower priority = can wait.
- Consider how overdue it is — very overdue items should be done soon or might need to be dropped
- Return JSON: { "items": [{ "id": "<task_id>", "new_due_at": "<ISO date>", "reason": "<brief reason>" }] }
- Use ISO 8601 dates with timezone`;

  try {
    const res = await ctx.anthropic!.messages.create({
      model: MODELS.fast,
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: "user", content: `NOW: ${now.toISOString()}\nOVERDUE TASKS (${overdue.length}):\n${block}` }],
    });
    const content = res.content.map((c: any) => (c.type === "text" ? c.text : "")).join("");
    const json = extractJson(content);
    const out = ResSchema.parse(json);

    const known = new Set(overdue.map((t: any) => t.id));
    out.items = out.items
      .filter((it) => known.has(it.id))
      .map((it) => ({ ...it, new_due_at: normalizeToMorning(it.new_due_at) }));

    await logAiCall(ctx.userId, "reschedule_task", { model: res.model, status: 200 });
    return jsonOk(out);
  } catch (e: any) {
    console.error("[v1/ai] reschedule-overdue", e?.message ?? e);
    return jsonError(502, "reschedule_failed", e?.message ?? String(e));
  }
}
