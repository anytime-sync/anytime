import { NextRequest } from "next/server";
import { z } from "zod";
import { resolveAiContext, jsonError, jsonOk } from "../_lib/ai-handler";
import { prepMeetingSystem } from "@/lib/ai/prompts";
import { extractJson } from "@/lib/ai/types";
import { logAiCall } from "@/lib/ai-rate-limit";
import { MODELS } from "@/lib/anthropic";

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
 * POST /api/v1/ai/prep-meeting
 * Body: { task_id, title, notes?, refresh? }
 * Returns: { agenda: [...], questions: [...] }
 */
export async function POST(req: NextRequest) {
  const resolved = await resolveAiContext(req, "prep_meeting");
  if (!resolved.ok) return resolved.response;
  const { ctx } = resolved;

  let body: unknown;
  try { body = await req.json(); } catch { body = {}; }
  const parsed = ReqSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "bad_request", parsed.error.message);
  const { task_id, title, notes, refresh } = parsed.data;

  // Cache check
  if (!refresh) {
    const { data: cached } = await ctx.supabase
      .from("task_agenda_cache")
      .select("agenda, source_title, source_notes")
      .eq("task_id", task_id)
      .maybeSingle();
    if (cached && cached.source_title === title && (cached.source_notes ?? null) === (notes ?? null)) {
      return jsonOk({ ...(cached.agenda as object), cached: true });
    }
  }

  const userMsg = [
    `Meeting: ${title}`,
    notes ? `Context: ${notes}` : "",
  ].filter(Boolean).join("\n");

  try {
    const res = await ctx.anthropic!.messages.create({
      model: MODELS.fast,
      max_tokens: 600,
      system: prepMeetingSystem(ctx.language),
      messages: [{ role: "user", content: userMsg }],
    });
    const content = res.content.map((c: any) => (c.type === "text" ? c.text : "")).join("");
    const json = extractJson(content);
    const out = ResSchema.parse(json);

    // Cache the result
    await ctx.supabase.from("task_agenda_cache").upsert({
      task_id,
      user_id: ctx.userId,
      source_title: title,
      source_notes: notes ?? null,
      agenda: out,
    }, { onConflict: "task_id" });

    await logAiCall(ctx.userId, "prep_meeting", { model: res.model, status: 200 });
    return jsonOk(out);
  } catch (e: any) {
    console.error("[v1/ai] prep-meeting", e?.message ?? e);
    return jsonError(502, "prep_meeting_failed", e?.message ?? String(e));
  }
}
