import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnthropic, MODELS } from "@/lib/anthropic";
import { checkAiBudget, logAiCall } from "@/lib/ai-rate-limit";
import { parseTaskSystem } from "@/lib/ai/prompts";
import { ParsedTaskSchema, extractJson } from "@/lib/ai/types";
import type { LanguageCode } from "@/lib/i18n";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Per-user daily AI budget check (Anthropic cost guard).
  const __budget = await checkAiBudget(u.user.id, "parse_task");
  if (!__budget.ok) {
    return NextResponse.json(
      { error: "rate_limited", used: __budget.used, limit: __budget.limit },
      { status: 429, headers: { "Retry-After": String(__budget.retryAfter) } }
    );
  }

  const client = getAnthropic();
  if (!client) return NextResponse.json({ error: "ai_disabled" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const text: string = (body.text ?? "").toString().trim();
  const tz: string = body.tz || "UTC";
  if (!text) return NextResponse.json({ error: "empty" }, { status: 400 });

  // Read user's preferred language for prompt and title preservation.
  const { data: prefs } = await supabase
    .from("user_preferences")
    .select("language")
    .eq("user_id", u.user.id)
    .maybeSingle();
  const language = (prefs?.language ?? "en") as LanguageCode;

  const now = new Date();
  const userMessage = `NOW: ${now.toISOString()} (${tz})
WEEKDAY: ${now.toLocaleDateString("en-US", { weekday: "long", timeZone: tz })}

INPUT: ${text}`;

  try {
    const res = await client.messages.create({
      model: MODELS.fast,
      max_tokens: 600,
      system: parseTaskSystem(language),
      messages: [{ role: "user", content: userMessage }],
    });
    const content = res.content
      .map((c) => (c.type === "text" ? c.text : ""))
      .join("");
    const json = extractJson(content);
    const parsed = ParsedTaskSchema.parse(json);
    await logAiCall(u.user.id, "parse_task", { model: res.model, status: 200 });
    return NextResponse.json(parsed);
  } catch (e: any) {
    console.error("[ai]", "\n", e?.stack || e?.message || e);
    return NextResponse.json(
      { error: "parse_failed", detail: e?.message ?? String(e) },
      { status: 502 }
    );
  }
}
