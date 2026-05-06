import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAnthropic, MODELS } from "@/lib/anthropic";
import { checkAiBudget, logAiCall } from "@/lib/ai-rate-limit";
import { translateTaskSystem } from "@/lib/ai/prompts";
import { extractJson } from "@/lib/ai/types";
import type { LanguageCode } from "@/lib/i18n";

export const runtime = "nodejs";

const ReqSchema = z.object({
  task_id: z.string(),
  source_title: z.string().min(1).max(280),
  target_locale: z.string().min(2).max(8),
});
const ResSchema = z.object({ translation: z.string() });

/**
 * /api/ai/translate-task — translate one task title to a target locale.
 * Cached in task_translations (PK task_id + locale). Re-translates only
 * when source_title differs from the cached one.
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { body = {}; }
  const parsed = ReqSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const { task_id, source_title, target_locale } = parsed.data;

  // Cache hit?
  const { data: cached } = await supabase
    .from("task_translations")
    .select("translated_title, source_title")
    .eq("task_id", task_id)
    .eq("locale", target_locale)
    .maybeSingle();
  if (cached && cached.source_title === source_title) {
    return NextResponse.json({ translation: cached.translated_title, cached: true });
  }

  const __budget = await checkAiBudget(u.user.id, "translate_task");
  if (!__budget.ok) {
    return NextResponse.json({ error: "rate_limited", used: __budget.used, limit: __budget.limit }, { status: 429 });
  }
  const client = getAnthropic();
  if (!client) return NextResponse.json({ error: "ai_disabled" }, { status: 503 });

  try {
    const res = await client.messages.create({
      model: MODELS.fast,
      max_tokens: 200,
      system: translateTaskSystem(target_locale as LanguageCode),
      messages: [{ role: "user", content: source_title }],
    });
    const content = res.content.map((c) => (c.type === "text" ? c.text : "")).join("");
    const json = extractJson(content);
    const out = ResSchema.parse(json);

    await supabase.from("task_translations").upsert(
      { task_id, locale: target_locale, source_title, translated_title: out.translation },
      { onConflict: "task_id,locale" }
    );
    await logAiCall(u.user.id, "translate_task", { model: res.model, status: 200 });
    return NextResponse.json({ translation: out.translation, cached: false });
  } catch (e: any) {
    console.error("[ai] translate-task", e?.message ?? e);
    return NextResponse.json({ error: "translate_failed", detail: e?.message ?? String(e) }, { status: 502 });
  }
}
