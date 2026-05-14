import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnthropic, MODELS } from "@/lib/anthropic";
import { checkAiBudget, logAiCall } from "@/lib/ai-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/ai/reflection-patterns
 *
 * Reads the last ~7 daily reflections with journal entries and asks the
 * model to surface ONE quiet, useful pattern — a single sentence, calm
 * editorial voice, no moralizing.
 *
 * The /pricing carousel promises a "Connected the dots" block; this is
 * the endpoint that backs it.
 *
 * Gracefully returns { insight: null } when there isn't enough data to
 * say anything honest (fewer than two reflections with journal entries).
 * Rate-limited like other AI routes.
 */
export async function GET() {
  const supabase = createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Last 7 reflections with a journal entry, newest first.
  const { data: rows } = await supabase
    .from("daily_reflections")
    .select("local_date, headline, user_journal")
    .eq("user_id", u.user.id)
    .not("user_journal", "is", null)
    .order("local_date", { ascending: false })
    .limit(7);

  const sample = rows ?? [];
  if (sample.length < 2) {
    return NextResponse.json({ insight: null, sample_size: sample.length });
  }

  const budget = await checkAiBudget(u.user.id, "reflection");
  if (!budget.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const client = getAnthropic();
  if (!client) return NextResponse.json({ error: "ai_disabled" }, { status: 503 });

  const journalBlock = sample
    .map(
      (r) =>
        `${r.local_date} · ${r.headline ?? ""}\n${(r.user_journal ?? "").slice(0, 500)}`
    )
    .join("\n\n---\n\n");

  const system = [
    "You read short personal end-of-day reflections and find one quiet,",
    "useful pattern across them. Output ONE sentence, at most 25 words.",
    "Calm editorial voice — like a single sentence from The Economist.",
    "No moralizing. No bullet lists. No emoji. No hashtags. No second sentence.",
    "",
    "If there's no real pattern, output exactly: Too soon to call.",
  ].join("\n");

  try {
    const res = await client.messages.create({
      model: MODELS.fast,
      max_tokens: 120,
      system,
      messages: [
        {
          role: "user",
          content: `Last ${sample.length} reflections, newest first:\n\n${journalBlock}`,
        },
      ],
    });
    const insight = res.content
      .map((c) => (c.type === "text" ? c.text : ""))
      .join("")
      .trim();

    await logAiCall(u.user.id, "reflection", {
      model: res.model,
      status: 200,
    });
    return NextResponse.json({
      insight: insight === "Too soon to call." ? null : insight,
      sample_size: sample.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[ai] reflection-patterns", msg);
    return NextResponse.json(
      { error: "ai_failed", detail: msg },
      { status: 502 }
    );
  }
}
