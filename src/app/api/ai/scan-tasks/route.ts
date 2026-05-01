import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnthropic, MODELS } from "@/lib/anthropic";
import { checkAiBudget, logAiCall } from "@/lib/ai-rate-limit";
import { scanTasksSystem } from "@/lib/ai/prompts";
import { ScannedTasksSchema, extractJson } from "@/lib/ai/types";
import type { LanguageCode } from "@/lib/i18n";

export const runtime = "nodejs";

/**
 * Vision-based bulk task extractor.
 *
 * The user uploads one image (a sticky note, a whiteboard, a calendar
 * page, a screenshot of an email thread). Claude reads the image and
 * returns an array of tasks with title / date / time / priority parsed
 * out. The client shows a preview list, lets the user edit or uncheck,
 * then bulk-creates the confirmed rows.
 *
 * We accept multipart/form-data with a single `file` field (max ~6MB,
 * which is Anthropic's per-image cap). Larger files get a 413.
 */

// Anthropic's hard cap for inline base64 images. We reject above this
// in the route so the user gets a meaningful error rather than a
// 400 from the SDK.
const MAX_BYTES = 6 * 1024 * 1024;
const ACCEPT = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Per-user daily AI budget check. Vision calls are more expensive than
  // text parses, so they share the parse_task budget — the user can't
  // bypass their daily cap by switching to scan.
  const __budget = await checkAiBudget(u.user.id, "parse_task");
  if (!__budget.ok) {
    return NextResponse.json(
      { error: "rate_limited", used: __budget.used, limit: __budget.limit },
      { status: 429, headers: { "Retry-After": String(__budget.retryAfter) } }
    );
  }

  const client = getAnthropic();
  if (!client) return NextResponse.json({ error: "ai_disabled" }, { status: 503 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "bad_form" }, { status: 400 });
  }
  const file = form.get("file");
  const tz = (form.get("tz") as string) || "UTC";
  if (!file || typeof file === "string" || !("arrayBuffer" in file)) {
    return NextResponse.json({ error: "no_file" }, { status: 400 });
  }
  const blob = file as File;
  if (blob.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "too_large", limit: MAX_BYTES, size: blob.size },
      { status: 413 }
    );
  }
  const mediaType = (blob.type || "image/jpeg").toLowerCase();
  if (!ACCEPT.has(mediaType)) {
    return NextResponse.json({ error: "bad_type", type: mediaType }, { status: 415 });
  }
  const buf = new Uint8Array(await blob.arrayBuffer());
  // Convert to base64 for Anthropic's image content block.
  const b64 = Buffer.from(buf).toString("base64");

  // Read user's preferred language so titles preserve the language the
  // user actually wrote on their note.
  const { data: prefs } = await supabase
    .from("user_preferences")
    .select("language")
    .eq("user_id", u.user.id)
    .maybeSingle();
  const language = (prefs?.language ?? "en") as LanguageCode;

  const now = new Date();
  const userText = `NOW: ${now.toISOString()} (${tz})
WEEKDAY: ${now.toLocaleDateString("en-US", { weekday: "long", timeZone: tz })}

Read the attached image and extract every actionable task you can see.`;

  try {
    const res = await client.messages.create({
      model: MODELS.fast,
      max_tokens: 1500,
      system: scanTasksSystem(language),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
                data: b64,
              },
            },
            { type: "text", text: userText },
          ],
        },
      ],
    });
    const content = res.content
      .map((c) => (c.type === "text" ? c.text : ""))
      .join("");
    const json = extractJson(content);
    const parsed = ScannedTasksSchema.parse(json);
    await logAiCall(u.user.id, "parse_task", {
      model: res.model,
      status: 200,
      // Note in the metadata that this was a vision call so we can
      // separate vision from text usage in the analytics view later.
      vision: true,
      tasks: parsed.tasks.length,
    } as any);
    return NextResponse.json(parsed);
  } catch (e: any) {
    console.error("[ai/scan-tasks]", "\n", e?.stack || e?.message || e);
    return NextResponse.json(
      { error: "scan_failed", detail: e?.message ?? String(e) },
      { status: 502 }
    );
  }
}
