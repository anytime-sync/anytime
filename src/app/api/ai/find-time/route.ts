import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAnthropic, MODELS } from "@/lib/anthropic";
import { checkAiBudget, logAiCall } from "@/lib/ai-rate-limit";
import { findTimeSystem } from "@/lib/ai/prompts";
import { extractJson } from "@/lib/ai/types";
import type { LanguageCode } from "@/lib/i18n";

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

/**
 * /api/ai/find-time — suggests 3 candidate slots in the next 7 days for
 * one task. Pulls the user's busy windows from existing time-blocked
 * tasks so the AI doesn't double-book.
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const __budget = await checkAiBudget(u.user.id, "find_time");
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
  const { task_id, title, estimated_minutes } = parsed.data;

  const { data: prefs } = await supabase
    .from("user_preferences")
    .select("language")
    .eq("user_id", u.user.id)
    .maybeSingle();
  const language = (prefs?.language ?? "en") as LanguageCode;

  // Pull busy blocks: any time-blocked task in next 7d.
  const horizon = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: busyTasks } = await supabase
    .from("tasks")
    .select("title, start_at, due_at")
    .eq("user_id", u.user.id)
    .not("start_at", "is", null)
    .lte("start_at", horizon);
  const busyBlock = (busyTasks ?? [])
    .filter((t) => t.start_at && t.due_at)
    .slice(0, 50)
    .map((t) => `${t.start_at} → ${t.due_at} (${t.title})`)
    .join("\n");

  const userMsg = [
    `NOW: ${new Date().toISOString()}`,
    `TASK: ${title}`,
    `DURATION: ${estimated_minutes ?? 30} minutes`,
    `BUSY_BLOCKS (next 7d):`,
    busyBlock || "(none)",
  ].join("\n");

  try {
    const res = await client.messages.create({
      model: MODELS.fast,
      max_tokens: 800,
      system: findTimeSystem(language),
      messages: [{ role: "user", content: userMsg }],
    });
    const content = res.content.map((c) => (c.type === "text" ? c.text : "")).join("");
    const json = extractJson(content);
    const out = ResSchema.parse(json);

    await logAiCall(u.user.id, "find_time", { model: res.model, status: 200, task_id });
    return NextResponse.json(out);
  } catch (e: any) {
    console.error("[ai] find-time", "\n", e?.stack || e?.message || e);
    return NextResponse.json({ error: "find_time_failed", detail: e?.message ?? String(e) }, { status: 502 });
  }
}
