import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAnthropic, MODELS } from "@/lib/anthropic";
import { checkAiBudget, logAiCall } from "@/lib/ai-rate-limit";
import { estimateTaskSystem } from "@/lib/ai/prompts";
import { extractJson } from "@/lib/ai/types";
import type { LanguageCode } from "@/lib/i18n";

export const runtime = "nodejs";

const ReqSchema = z.object({
  task_id: z.string(),
  title: z.string().min(1).max(280),
  notes: z.string().nullable().optional(),
  project: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
});

const ResSchema = z.object({
  minutes: z.number().int().min(5).max(480),
  confidence: z.enum(["low", "med", "high"]),
  rationale: z.string(),
});

/**
 * /api/ai/estimate-task — predicts wall-clock minutes for a single task.
 * Persists the result to tasks.estimated_minutes so it's available
 * everywhere (workload header, find-time, plan-day) without re-asking.
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const __budget = await checkAiBudget(u.user.id, "estimate_task");
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
  const { task_id, title, notes, project, tags } = parsed.data;

  const { data: prefs } = await supabase
    .from("user_preferences")
    .select("language")
    .eq("user_id", u.user.id)
    .maybeSingle();
  const language = (prefs?.language ?? "en") as LanguageCode;

  const userMsg = [
    `TITLE: ${title}`,
    notes ? `NOTES: ${notes.slice(0, 500)}` : null,
    project ? `PROJECT: ${project}` : null,
    tags && tags.length ? `TAGS: ${tags.join(", ")}` : null,
  ].filter(Boolean).join("\n");

  try {
    const res = await client.messages.create({
      model: MODELS.fast,
      max_tokens: 200,
      system: estimateTaskSystem(language),
      messages: [{ role: "user", content: userMsg }],
    });
    const content = res.content.map((c) => (c.type === "text" ? c.text : "")).join("");
    const json = extractJson(content);
    const out = ResSchema.parse(json);

    // Persist to the task row so other surfaces can read it.
    await supabase
      .from("tasks")
      .update({ estimated_minutes: out.minutes })
      .eq("id", task_id)
      .eq("user_id", u.user.id);

    await logAiCall(u.user.id, "estimate_task", { model: res.model, status: 200 });
    return NextResponse.json(out);
  } catch (e: any) {
    console.error("[ai] estimate-task", "\n", e?.stack || e?.message || e);
    return NextResponse.json({ error: "estimate_failed", detail: e?.message ?? String(e) }, { status: 502 });
  }
}
