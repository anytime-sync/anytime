import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnthropic, MODELS } from "@/lib/anthropic";
import { quadrantSystem } from "@/lib/ai/prompts";
import { QuadrantResultSchema, extractJson } from "@/lib/ai/types";
import type { LanguageCode } from "@/lib/i18n";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const client = getAnthropic();
  if (!client) return NextResponse.json({ error: "ai_disabled" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const title: string = (body.title ?? "").toString();
  if (!title) return NextResponse.json({ error: "empty" }, { status: 400 });

  const { data: prefs } = await supabase
    .from("user_preferences")
    .select("language")
    .eq("user_id", u.user.id)
    .maybeSingle();
  const language = (prefs?.language ?? "en") as LanguageCode;

  const lines = [
    `TITLE: ${title}`,
    body.due_at ? `DUE: ${body.due_at}` : "DUE: (none)",
    `PRIORITY: ${body.priority ?? 0}`,
    body.project ? `PROJECT: ${body.project}` : "",
    `NOW: ${new Date().toISOString()}`,
  ].filter(Boolean);

  try {
    const res = await client.messages.create({
      model: MODELS.fast,
      max_tokens: 200,
      system: quadrantSystem(language),
      messages: [{ role: "user", content: lines.join("\n") }],
    });
    const content = res.content
      .map((c) => (c.type === "text" ? c.text : ""))
      .join("");
    const json = extractJson(content);
    const parsed = QuadrantResultSchema.parse(json);
    return NextResponse.json(parsed);
  } catch (e: any) {
    console.error("[ai]", "\n", e?.stack || e?.message || e);
    return NextResponse.json(
      { error: "quadrant_failed", detail: e?.message ?? String(e) },
      { status: 502 }
    );
  }
}
