import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAnthropic, MODELS } from "@/lib/anthropic";
import { checkAiBudget, logAiCall } from "@/lib/ai-rate-limit";
import { rescheduleTaskSystem } from "@/lib/ai/prompts";
import { extractJson } from "@/lib/ai/types";
import type { LanguageCode } from "@/lib/i18n";

export const runtime = "nodejs";
import { safeTimezone, normalizeToMorning } from "@/lib/ai/tz";

const ReqSchema = z.object({
  tz: z.string().optional(),
  tasks: z.array(z.object({
    id: z.string(),
    title: z.string(),
    due_at: z.string().nullable(),
    priority: z.number().int().min(0).max(5),
    days_overdue: z.number().int().min(0),
  })).min(1).max(40),
});

const ResSchema = z.object({
  suggestions: z.array(z.object({
    id: z.string(),
    new_due_at: z.string().nullable(),
    verdict: z.enum(["reschedule", "defer-far", "drop"]),
    reason: z.string(),
  })),
});

/**
 * /api/ai/reschedule-task — bulk reschedule overdue tasks. Returns
 * suggestions only; UI applies them on user confirmation.
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const __budget = await checkAiBudget(u.user.id, "reschedule_task");
  if (!__budget.ok) {
    return NextResponse.json(
      { error: "rate_limited", used: __budget.used, limit: __budget.limit },
      { status: 429, headers: { "Retry-After": String(__budget.retryAfter) } }
    );
  }
  const client = getAnthropic();
  if (!client) return NextResponse.json({ error: "ai_disabled" }, { status: 503 });

  let body: unknown;
  try { body = await req.json(); } catch { body = {}; }
  const parsed = ReqSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request", detail: parsed.error.message }, { status: 400 });
  }
  const { tasks, tz: rawTz } = parsed.data;
  const tz = safeTimezone(rawTz);

  const { data: prefs } = await supabase
    .from("user_preferences")
    .select("language")
    .eq("user_id", u.user.id)
    .maybeSingle();
  const language = (prefs?.language ?? "en") as LanguageCode;

  const taskBlock = tasks
    .map((t) => `[${t.id}] ${t.title} · was due ${t.due_at ?? "n/a"} · ${t.days_overdue}d overdue · p${t.priority}`)
    .join("\n");

  const userMsg = [
    `NOW: ${new Date().toLocaleString("sv-SE", { timeZone: tz }).replace(" ", "T")} (${tz})`,
    `USER_TIMEZONE: ${tz}`,
    `OVERDUE TASKS (${tasks.length}):`,
    taskBlock,
  ].join("\n");

  try {
    const res = await client.messages.create({
      model: MODELS.fast,
      max_tokens: 1500,
      system: rescheduleTaskSystem(language),
      messages: [{ role: "user", content: userMsg }],
    });
    const content = res.content.map((c) => (c.type === "text" ? c.text : "")).join("");
    const json = extractJson(content);
    const out = ResSchema.parse(json);

    const known = new Set(tasks.map((t) => t.id));
    out.suggestions = out.suggestions
      .filter((s) => known.has(s.id))
      .map((s) => ({ ...s, new_due_at: normalizeToMorning(s.new_due_at, tz) }));

    await logAiCall(u.user.id, "reschedule_task", { model: res.model, status: 200, inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens });
    return NextResponse.json(out);
  } catch (e: any) {
    console.error("[ai] reschedule-task", "\n", e?.stack || e?.message || e);
    return NextResponse.json({ error: "reschedule_failed", detail: e?.message ?? String(e) }, { status: 502 });
  }
}
