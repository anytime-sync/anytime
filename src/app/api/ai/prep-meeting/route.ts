import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAnthropic, MODELS } from "@/lib/anthropic";
import { checkAiBudget, logAiCall } from "@/lib/ai-rate-limit";
import { prepMeetingSystem } from "@/lib/ai/prompts";
import { extractJson } from "@/lib/ai/types";
import type { LanguageCode } from "@/lib/i18n";

export const runtime = "nodejs";

const ReqSchema = z.object({
  task_id: z.string(),
  title: z.string().min(1).max(280),
  notes: z.string().nullable().optional(),
  refresh: z.boolean().optional(),
});

const ResSchema = z.object({
  agenda: z.array(z.string()).min(1).max(5),
  questions: z.array(z.string()).min(1).max(3),
});

/**
 * /api/ai/prep-meeting — generates a brief agenda + questions for a meeting
 * task. Caches the result in task_agenda_cache so repeat clicks are free.
 * Pass refresh:true to force regeneration.
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { body = {}; }
  const parsed = ReqSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request", detail: parsed.error.message }, { status: 400 });
  }
  const { task_id, title, notes, refresh } = parsed.data;

  // Cache hit?
  if (!refresh) {
    const { data: cached } = await supabase
      .from("task_agenda_cache")
      .select("agenda, source_title, source_notes")
      .eq("task_id", task_id)
      .maybeSingle();
    if (cached && cached.source_title === title && (cached.source_notes ?? null) === (notes ?? null)) {
      return NextResponse.json({ ...(cached.agenda as object), cached: true });
    }
  }

  const __budget = await checkAiBudget(u.user.id, "prep_meeting");
  if (!__budget.ok) {
    return NextResponse.json(
      { error: "rate_limited", used: __budget.used, limit: __budget.limit },
      { status: 429, headers: { "Retry-After": String(__budget.retryAfter) } }
    );
  }
  const client = getAnthropic();
  if (!client) return NextResponse.json({ error: "ai_disabled" }, { status: 503 });

  const { data: prefs } = await supabase
    .from("user_preferences")
    .select("language")
    .eq("user_id", u.user.id)
    .maybeSingle();
  const language = (prefs?.language ?? "en") as LanguageCode;

  const userMsg = [
    `MEETING TITLE: ${title}`,
    notes ? `CONTEXT NOTES: ${notes.slice(0, 1000)}` : "(no context notes)",
  ].join("\n");

  try {
    const res = await client.messages.create({
      model: MODELS.fast,
      max_tokens: 700,
      system: prepMeetingSystem(language),
      messages: [{ role: "user", content: userMsg }],
    });
    const content = res.content.map((c) => (c.type === "text" ? c.text : "")).join("");
    const json = extractJson(content);
    const out = ResSchema.parse(json);

    await supabase.from("task_agenda_cache").upsert(
      {
        task_id,
        user_id: u.user.id,
        agenda: out,
        source_title: title,
        source_notes: notes ?? null,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "task_id" }
    );

    await logAiCall(u.user.id, "prep_meeting", { model: res.model, status: 200, task_id });
    return NextResponse.json({ ...out, cached: false });
  } catch (e: any) {
    console.error("[ai] prep-meeting", "\n", e?.stack || e?.message || e);
    return NextResponse.json({ error: "prep_meeting_failed", detail: e?.message ?? String(e) }, { status: 502 });
  }
}
