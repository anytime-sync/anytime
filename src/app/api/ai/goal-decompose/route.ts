import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAnthropic, MODELS } from "@/lib/anthropic";
import { checkAiBudget, logAiCall } from "@/lib/ai-rate-limit";
import { goalDecomposeSystem } from "@/lib/ai/prompts";
import { extractJson } from "@/lib/ai/types";
import type { LanguageCode } from "@/lib/i18n";

export const runtime = "nodejs";

const ReqSchema = z.object({ goal: z.string().min(4).max(280) });
const ResSchema = z.object({
  project_name: z.string(),
  summary: z.string(),
  tasks: z.array(z.object({
    title: z.string(),
    due_offset_days: z.number().int().min(0).max(60),
    priority: z.union([z.literal(0), z.literal(1), z.literal(3), z.literal(5)]),
    quadrant: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
    rationale: z.string(),
  })).min(1).max(12),
});

/**
 * /api/ai/goal-decompose — turns a written goal into a project + task tree.
 * Returns suggestions only; UI confirms before inserting (so the user can
 * tweak titles/dates).
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const __budget = await checkAiBudget(u.user.id, "goal_decompose");
  if (!__budget.ok) {
    return NextResponse.json({ error: "rate_limited", used: __budget.used, limit: __budget.limit }, { status: 429 });
  }
  const client = getAnthropic();
  if (!client) return NextResponse.json({ error: "ai_disabled" }, { status: 503 });

  let body: unknown;
  try { body = await req.json(); } catch { body = {}; }
  const parsed = ReqSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request", detail: parsed.error.message }, { status: 400 });
  }

  const { data: prefs } = await supabase
    .from("user_preferences").select("language").eq("user_id", u.user.id).maybeSingle();
  const language = (prefs?.language ?? "en") as LanguageCode;

  try {
    const res = await client.messages.create({
      model: MODELS.fast,
      max_tokens: 1800,
      system: goalDecomposeSystem(language),
      messages: [{ role: "user", content: `NOW: ${new Date().toISOString()}\nGOAL: ${parsed.data.goal}` }],
    });
    const content = res.content.map((c) => (c.type === "text" ? c.text : "")).join("");
    const json = extractJson(content);
    const out = ResSchema.parse(json);

    await logAiCall(u.user.id, "goal_decompose", { model: res.model, status: 200 });
    return NextResponse.json(out);
  } catch (e: any) {
    console.error("[ai] goal-decompose", e?.message ?? e);
    return NextResponse.json({ error: "goal_decompose_failed", detail: e?.message ?? String(e) }, { status: 502 });
  }
}
