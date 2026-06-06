import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAnthropic, MODELS } from "@/lib/anthropic";
import { checkAiBudget, logAiCall } from "@/lib/ai-rate-limit";
import { procrastinationSystem } from "@/lib/ai/prompts";
import { extractJson } from "@/lib/ai/types";
import type { LanguageCode } from "@/lib/i18n";

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

/**
 * /api/ai/procrastination — finds 3-5 stuck tasks and recommends a verdict.
 * Pulls open tasks the user has had for >= 14 days with no recent edit.
 */
export async function POST() {
  const supabase = createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const __budget = await checkAiBudget(u.user.id, "procrastination");
  if (!__budget.ok) {
    return NextResponse.json({ error: "rate_limited", used: __budget.used, limit: __budget.limit }, { status: 429 });
  }
  const client = getAnthropic();
  if (!client) return NextResponse.json({ error: "ai_disabled" }, { status: 503 });

  // Stuck candidates: open, created >= 14 days ago, updated >= 7 days ago.
  const fortnightAgo = new Date(Date.now() - 14 * 86400_000).toISOString();
  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
  const { data: candidates } = await supabase
    .from("tasks")
    .select("id, title, created_at, updated_at, priority, due_at")
    .eq("user_id", u.user.id)
    .eq("is_completed", false)
    .lte("created_at", fortnightAgo)
    .lte("updated_at", weekAgo)
    .order("updated_at", { ascending: true })
    .limit(40);

  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ items: [], summary: "Nothing's been hanging around — clean list." });
  }

  const { data: prefs } = await supabase
    .from("user_preferences").select("language").eq("user_id", u.user.id).maybeSingle();
  const language = (prefs?.language ?? "en") as LanguageCode;

  const now = Date.now();
  const block = candidates.map((t) => {
    const daysOpen = Math.floor((now - new Date(t.created_at!).getTime()) / 86400_000);
    const lastTouched = Math.floor((now - new Date(t.updated_at!).getTime()) / 86400_000);
    return `[${t.id}] ${t.title} · open ${daysOpen}d · touched ${lastTouched}d ago · p${t.priority}`;
  }).join("\n");

  try {
    const res = await client.messages.create({
      model: MODELS.fast,
      max_tokens: 1500,
      system: procrastinationSystem(language),
      messages: [{ role: "user", content: `NOW: ${new Date().toISOString()}\nSTUCK CANDIDATES (${candidates.length}):\n${block}` }],
    });
    const content = res.content.map((c) => (c.type === "text" ? c.text : "")).join("");
    const json = extractJson(content);
    const out = ResSchema.parse(json);

    const known = new Set(candidates.map((t) => t.id));
    out.items = out.items.filter((it) => known.has(it.id));

    await logAiCall(u.user.id, "procrastination", { model: res.model, status: 200, inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens });
    return NextResponse.json(out);
  } catch (e: any) {
    console.error("[ai] procrastination", e?.message ?? e);
    return NextResponse.json({ error: "procrastination_failed", detail: e?.message ?? String(e) }, { status: 502 });
  }
}
