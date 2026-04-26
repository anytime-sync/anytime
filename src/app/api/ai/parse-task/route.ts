import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnthropic, MODELS } from "@/lib/anthropic";
import { PARSE_TASK_SYSTEM } from "@/lib/ai/prompts";
import { ParsedTaskSchema, extractJson } from "@/lib/ai/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const client = getAnthropic();
  if (!client) return NextResponse.json({ error: "ai_disabled" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const text: string = (body.text ?? "").toString().trim();
  const tz: string = body.tz || "UTC";
  if (!text) return NextResponse.json({ error: "empty" }, { status: 400 });

  const now = new Date();
  const userMessage = `NOW: ${now.toISOString()} (${tz})
WEEKDAY: ${now.toLocaleDateString("en-US", { weekday: "long", timeZone: tz })}

INPUT: ${text}`;

  try {
    const res = await client.messages.create({
      model: MODELS.fast,
      max_tokens: 600,
      system: PARSE_TASK_SYSTEM,
      messages: [{ role: "user", content: userMessage }],
    });
    const content = res.content
      .map((c) => (c.type === "text" ? c.text : ""))
      .join("");
    const json = extractJson(content);
    const parsed = ParsedTaskSchema.parse(json);
    return NextResponse.json(parsed);
  } catch (e: any) {
    return NextResponse.json(
      { error: "parse_failed", detail: e?.message ?? String(e) },
      { status: 502 }
    );
  }
}
