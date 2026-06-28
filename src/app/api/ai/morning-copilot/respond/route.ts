import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkAiBudget } from "@/lib/ai-rate-limit";
import type { LanguageCode } from "@/lib/i18n";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Respond to today's Morning Co-pilot brief.
 *
 * POST { action: 'apply' | 'snooze' | 'dismiss',
 *        tz: string,
 *        applied_action_indexes?: number[] }
 *
 * The route only mutates the brief row's status — the actual task
 * mutations (defer / drop / batch) are done from the client through
 * RLS-gated supabase calls so each user's session is the authority. We
 * receive the indexes purely so we can stash them in the row's `brief`
 * jsonb for replay/analytics, never to act on tasks server-side.
 */

function localDateKey(d: Date, tz: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d);
}

const ACTIONS = new Set(["apply", "snooze", "dismiss"] as const);

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // AI budget check — respond route may trigger follow-up AI processing
  const budget = await checkAiBudget(u.user.id, "morning_copilot");
  if (!budget.ok) {
    return NextResponse.json(
      { error: "rate_limited", used: budget.used, limit: budget.limit },
      { status: 429, headers: { "Retry-After": String(budget.retryAfter) } }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    tz?: string;
    applied_action_indexes?: number[];
  };
  const action = body.action;
  if (!action || !ACTIONS.has(action as any)) {
    return NextResponse.json(
      { error: "bad_action", detail: `expected one of ${[...ACTIONS].join(",")}` },
      { status: 400 }
    );
  }

  const tz = body.tz || "UTC";
  const today = localDateKey(new Date(), tz);

  const { data: prefs } = await supabase
    .from("user_preferences")
    .select("language")
    .eq("user_id", u.user.id)
    .maybeSingle();
  const language = (prefs?.language ?? "en") as LanguageCode;

  // Map the verb to the row status the schema expects.
  const status =
    action === "apply"
      ? "applied"
      : action === "snooze"
        ? "snoozed"
        : "dismissed";

  // Read existing row so we can carry `brief` forward + stash the
  // applied indexes inside it. The cache lookup mirrors the GET
  // route's key (user_id, local_date, language).
  const { data: existing } = await supabase
    .from("daily_copilot_log")
    .select("*")
    .eq("user_id", u.user.id)
    .eq("local_date", today)
    .eq("language", language)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json(
      { error: "not_found", detail: "no brief for today" },
      { status: 404 }
    );
  }

  const nextBrief = {
    ...((existing.brief as Record<string, unknown>) ?? {}),
    applied_action_indexes:
      action === "apply" && Array.isArray(body.applied_action_indexes)
        ? body.applied_action_indexes
        : undefined,
  };

  const { data: updated, error } = await supabase
    .from("daily_copilot_log")
    .update({
      status,
      responded_at: new Date().toISOString(),
      brief: nextBrief as any,
    })
    .eq("user_id", u.user.id)
    .eq("local_date", today)
    .eq("language", language)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "update_failed", detail: error.message },
      { status: 400 }
    );
  }
  return NextResponse.json(updated ?? { ok: true });
}
