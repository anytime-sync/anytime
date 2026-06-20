import { NextRequest } from "next/server";
import { z } from "zod";
import { resolveAiContext, jsonError, jsonOk } from "../_lib/ai-handler";
import { extractJson } from "@/lib/ai/types";
import { logAiCall } from "@/lib/ai-rate-limit";
import { MODELS } from "@/lib/anthropic";

export const runtime = "nodejs";
import { safeTimezone } from "@/lib/ai/tz";
import { fetchScheduleContext, renderScheduleContext } from "@/lib/ai/schedule-context";

const ResSchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    start_at: z.string().nullable().optional(),
    due_at: z.string().nullable().optional(),
    new_due_at: z.string().optional(), // legacy fallback
    reason: z.string(),
  })),
});

/**
 * POST /api/v1/ai/reschedule-overdue
 * No body required — automatically finds overdue tasks and suggests new dates.
 * Returns: { items: [{ id, new_due_at, reason }] }
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  let bodyJson: Record<string, unknown> = {};
  try { bodyJson = JSON.parse(rawBody); } catch { /* ok */ }
  const tz = safeTimezone(bodyJson.tz);
  const resolved = await resolveAiContext(req, "reschedule_task");
  if (!resolved.ok) return resolved.response;
  const { ctx } = resolved;

  const now = new Date();
  const nowLocal = now.toLocaleString("sv-SE", { timeZone: tz }).replace(" ", "T");
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

  // Fetch schedule context for real slot-finding
  const schedCtx = await fetchScheduleContext(ctx.supabase, ctx.userId, tz, 14);

  const block = overdue.map((t: any) => {
    const daysOverdue = Math.floor((now.getTime() - new Date(t.due_at!).getTime()) / 86400_000);
    return `[${t.id}] ${t.title} · p${t.priority} · ${daysOverdue}d overdue · was due ${t.due_at}`;
  }).join("\n");

  const systemPrompt = `You reschedule overdue tasks by finding real available time slots in the user's calendar.
Output JSON: { "items": [{ "id": "<task_id>", "start_at": "<ISO 8601>", "due_at": "<ISO 8601>", "reason": "<brief>" }] }
Rules:
- Use the SCHEDULE to find free slots — never overlap a busy block.
- Respect WORKING_HOURS. Place deep tasks in ENERGY_PEAK, admin in afternoon.
- Start times on :00 or :30 boundaries. Duration = DEFAULT_DURATION unless task title implies longer.
- Spread across days. Higher priority = sooner.
- Use correct UTC offset for USER_TIMEZONE in all timestamps.`;

  try {
    const res = await ctx.anthropic!.messages.create({
      model: MODELS.fast,
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: "user", content: [
        `NOW: ${nowLocal} (${tz})`,
        `USER_TIMEZONE: ${tz}`,
        "",
        renderScheduleContext(schedCtx),
        "",
        `OVERDUE TASKS (${overdue.length}):`,
        block,
      ].join("\n") }],
    });
    const content = res.content.map((c: any) => (c.type === "text" ? c.text : "")).join("");
    const json = extractJson(content);
    const out = ResSchema.parse(json);

    const known = new Set(overdue.map((t: any) => t.id));
    out.items = out.items.filter((it) => known.has(it.id));

    await logAiCall(ctx.userId, "reschedule_task", { model: res.model, status: 200 });
    return jsonOk(out);
  } catch (e: any) {
    console.error("[v1/ai] reschedule-overdue", e?.message ?? e);
    return jsonError(502, "reschedule_failed", e?.message ?? String(e));
  }
}
