import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAnthropic, MODELS } from "@/lib/anthropic";
import { checkAiBudget, logAiCall } from "@/lib/ai-rate-limit";
import { reflectionSystem } from "@/lib/ai/prompts";
import { extractJson } from "@/lib/ai/types";
import type { LanguageCode } from "@/lib/i18n";

export const runtime = "nodejs";

const ResSchema = z.object({
  headline: z.string(),
  body: z.string(),
  carry_forward_ids: z.array(z.string()).max(4).default([]),
  drop_suggestions_ids: z.array(z.string()).max(2).default([]),
});

/**
 * GET /api/ai/reflection — returns today's reflection (or generates it
 * if none exists yet). The dialog opens this on demand.
 *
 * POST /api/ai/reflection { journal: string } — saves the user's
 * journal entry to today's reflection row.
 */
export async function GET() {
  const supabase = createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const today = new Date().toISOString().slice(0, 10);

  // Already generated today?
  const { data: existing } = await supabase
    .from("daily_reflections")
    .select("*")
    .eq("user_id", u.user.id)
    .eq("local_date", today)
    .maybeSingle();
  if (existing && existing.headline) {
    return NextResponse.json(existing);
  }

  const __budget = await checkAiBudget(u.user.id, "reflection");
  if (!__budget.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const client = getAnthropic();
  if (!client) return NextResponse.json({ error: "ai_disabled" }, { status: 503 });

  // Today's surface: completed today + still-open due today/overdue.
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const isoStart = startOfDay.toISOString();
  const { data: doneToday } = await supabase
    .from("tasks")
    .select("id, title, completed_at")
    .eq("user_id", u.user.id)
    .gte("completed_at", isoStart)
    .order("completed_at", { ascending: true })
    .limit(20);
  const { data: openTasks } = await supabase
    .from("tasks")
    .select("id, title, due_at, priority")
    .eq("user_id", u.user.id)
    .eq("is_completed", false)
    .lte("due_at", new Date().toISOString())
    .order("due_at", { ascending: true })
    .limit(20);

  const { data: prefs } = await supabase
    .from("user_preferences").select("language").eq("user_id", u.user.id).maybeSingle();
  const language = (prefs?.language ?? "en") as LanguageCode;

  const userMsg = [
    `NOW: ${new Date().toISOString()}`,
    `DONE TODAY (${(doneToday ?? []).length}):`,
    (doneToday ?? []).map((t) => `[${t.id}] ${t.title}`).join("\n") || "(none)",
    `OPEN / DUE OR OVERDUE (${(openTasks ?? []).length}):`,
    (openTasks ?? []).map((t) => `[${t.id}] ${t.title} · p${t.priority}`).join("\n") || "(none)",
  ].join("\n");

  try {
    const res = await client.messages.create({
      model: MODELS.fast,
      max_tokens: 700,
      system: reflectionSystem(language),
      messages: [{ role: "user", content: userMsg }],
    });
    const content = res.content.map((c) => (c.type === "text" ? c.text : "")).join("");
    const json = extractJson(content);
    const out = ResSchema.parse(json);

    await supabase.from("daily_reflections").upsert(
      {
        user_id: u.user.id,
        local_date: today,
        headline: out.headline,
        body: out.body,
        carry_forward_ids: out.carry_forward_ids,
        drop_suggestions_ids: out.drop_suggestions_ids,
      },
      { onConflict: "user_id,local_date" }
    );

    await logAiCall(u.user.id, "reflection", { model: res.model, status: 200 });
    return NextResponse.json({ ...out, local_date: today });
  } catch (e: any) {
    console.error("[ai] reflection", e?.message ?? e);
    return NextResponse.json({ error: "reflection_failed", detail: e?.message ?? String(e) }, { status: 502 });
  }
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { journal?: string };
  try { body = await req.json(); } catch { body = {}; }
  const journal = (body.journal ?? "").trim().slice(0, 4000);

  const today = new Date().toISOString().slice(0, 10);
  const { error } = await supabase
    .from("daily_reflections")
    .update({ user_journal: journal || null })
    .eq("user_id", u.user.id)
    .eq("local_date", today);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
