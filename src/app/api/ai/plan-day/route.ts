import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAnthropic, MODELS } from "@/lib/anthropic";
import { checkAiBudget, logAiCall } from "@/lib/ai-rate-limit";
import { planDaySystem } from "@/lib/ai/prompts";
import { extractJson } from "@/lib/ai/types";
import type { LanguageCode } from "@/lib/i18n";

export const runtime = "nodejs";

/**
 * /api/ai/plan-day — single-day quadrant + priority planner.
 *
 * Mirrors plan-week but scoped to today's slice: due today, overdue,
 * or undated. Same input/output shape as plan-week so the existing
 * Plan-my-week modal UI can be reused with a different button + endpoint.
 */

const PlanDayRequestSchema = z.object({
  tasks: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        due_at: z.string().nullable().optional(),
        priority: z.number().int().min(0).max(5),
        project: z.string().nullable().optional(),
      })
    )
    .min(1)
    .max(40),
});

const PlanDayResultSchema = z.object({
  suggestions: z.array(
    z.object({
      id: z.string(),
      quadrant: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
      suggested_priority: z.union([z.literal(0), z.literal(1), z.literal(3), z.literal(5)]),
      reason: z.string(),
    })
  ),
  notes: z.string().optional(),
});

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const __budget = await checkAiBudget(u.user.id, "plan_day");
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
  const parsedReq = PlanDayRequestSchema.safeParse(body);
  if (!parsedReq.success) {
    return NextResponse.json({ error: "bad_request", detail: parsedReq.error.message }, { status: 400 });
  }
  const { tasks } = parsedReq.data;

  const { data: prefs } = await supabase
    .from("user_preferences")
    .select("language")
    .eq("user_id", u.user.id)
    .maybeSingle();
  const language = (prefs?.language ?? "en") as LanguageCode;

  const taskBlock = tasks
    .map((t) => {
      const parts = [
        `[${t.id}]`,
        t.title,
        t.due_at ? `· due ${t.due_at}` : "· undated",
        `· p${t.priority}`,
        t.project ? `· ${t.project}` : "",
      ];
      return parts.filter(Boolean).join(" ");
    })
    .join("\n");

  const userMsg = [
    `NOW: ${new Date().toISOString()}`,
    `WORKING_HORIZON: today (~12 hours)`,
    `TASKS (${tasks.length}):`,
    taskBlock,
  ].join("\n");

  try {
    const res = await client.messages.create({
      model: MODELS.fast,
      max_tokens: 1500,
      system: planDaySystem(language),
      messages: [{ role: "user", content: userMsg }],
    });
    const content = res.content
      .map((c) => (c.type === "text" ? c.text : ""))
      .join("");
    const json = extractJson(content);
    const parsed = PlanDayResultSchema.parse(json);

    const known = new Set(tasks.map((t) => t.id));
    const filtered = parsed.suggestions.filter((s) => known.has(s.id));

    await logAiCall(u.user.id, "plan_day", { model: res.model, status: 200 });
    return NextResponse.json({ suggestions: filtered, notes: parsed.notes ?? "" });
  } catch (e: any) {
    console.error("[ai] plan-day", "\n", e?.stack || e?.message || e);
    return NextResponse.json(
      { error: "plan_day_failed", detail: e?.message ?? String(e) },
      { status: 502 }
    );
  }
}
