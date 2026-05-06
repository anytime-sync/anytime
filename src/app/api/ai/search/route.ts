import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAnthropic, MODELS } from "@/lib/anthropic";
import { checkAiBudget, logAiCall } from "@/lib/ai-rate-limit";
import { searchSystem } from "@/lib/ai/prompts";
import { extractJson } from "@/lib/ai/types";
import type { LanguageCode } from "@/lib/i18n";

export const runtime = "nodejs";

const ReqSchema = z.object({ query: z.string().min(1).max(140) });
const ResSchema = z.object({
  matches: z.array(z.object({ id: z.string(), why: z.string() })).max(10),
});

/**
 * /api/ai/search — natural-language re-rank over the user's tasks.
 * No embeddings; we feed up to 200 task summaries to Anthropic and let
 * it pick + explain the matches. Cheap for typical inboxes; we'll add
 * embeddings only when this gets too slow.
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const __budget = await checkAiBudget(u.user.id, "search");
  if (!__budget.ok) {
    return NextResponse.json({ error: "rate_limited", used: __budget.used, limit: __budget.limit }, { status: 429 });
  }
  const client = getAnthropic();
  if (!client) return NextResponse.json({ error: "ai_disabled" }, { status: 503 });

  let body: unknown;
  try { body = await req.json(); } catch { body = {}; }
  const parsed = ReqSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  // Pre-filter: pull last 200 tasks with their projects/tags so the model
  // has a manageable candidate list. (Cheaper than embeddings; works for
  // typical inboxes.)
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, notes, project:projects(name), task_tags(tag:tags(name))")
    .eq("user_id", u.user.id)
    .order("updated_at", { ascending: false })
    .limit(200);

  const candidates = (tasks ?? []).map((t: any) => {
    const proj = t.project?.name ? ` — ~${t.project.name}` : "";
    const tags = (t.task_tags ?? []).map((tt: any) => tt.tag?.name).filter(Boolean).map((n: string) => `#${n}`).join(" ");
    return `[${t.id}] ${t.title}${proj}${tags ? " " + tags : ""}`;
  }).join("\n");

  const { data: prefs } = await supabase
    .from("user_preferences").select("language").eq("user_id", u.user.id).maybeSingle();
  const language = (prefs?.language ?? "en") as LanguageCode;

  try {
    const res = await client.messages.create({
      model: MODELS.fast,
      max_tokens: 1000,
      system: searchSystem(language),
      messages: [{ role: "user", content: `QUERY: ${parsed.data.query}\nCANDIDATES (${(tasks ?? []).length}):\n${candidates}` }],
    });
    const content = res.content.map((c) => (c.type === "text" ? c.text : "")).join("");
    const json = extractJson(content);
    const out = ResSchema.parse(json);

    const known = new Set((tasks ?? []).map((t) => t.id));
    out.matches = out.matches.filter((m) => known.has(m.id));

    await logAiCall(u.user.id, "search", { model: res.model, status: 200 });
    return NextResponse.json(out);
  } catch (e: any) {
    console.error("[ai] search", e?.message ?? e);
    return NextResponse.json({ error: "search_failed", detail: e?.message ?? String(e) }, { status: 502 });
  }
}
