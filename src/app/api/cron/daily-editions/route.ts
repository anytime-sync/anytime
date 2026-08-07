import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { checkAiBudget } from "@/lib/ai-rate-limit";
import { generateDailyEdition, localDateKey } from "@/lib/ai/daily-edition";
import type { LanguageCode } from "@/lib/i18n";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily Edition PRE-GENERATION cron — runs every hour.
 *
 * For each user whose LOCAL time right now matches their morning hour
 * (user_preferences.digest_send_hour, default 7), generate + cache TODAY's
 * Daily Edition if one does not already exist. This keeps the edition warm
 * so the product's core promise (a fresh briefing every morning) holds even
 * for users who open the app later in the day.
 *
 * Background: the edition was previously generated ONLY on demand, when a
 * user actively opened the app and hit /api/ai/daily-edition. With most
 * users dormant, editions went 26 days stale. Pre-generation fixes that.
 *
 * No email is sent here on purpose: users who want a morning touch already
 * receive /api/cron/daily-digest, whose CTA now lands on a freshly
 * pre-generated edition. A second morning email would be redundant. (A
 * dedicated "your edition is ready" email would be a small follow-up if
 * desired.)
 *
 * Cost + plan safety: every user goes through checkAiBudget("daily_edition")
 * — the SAME Pro-plan gate + per-UTC-day budget as the interactive route —
 * so non-Pro users are skipped and no user can run away with Anthropic
 * spend. Idempotent: any (user, date, language) that already has a row is
 * skipped, so Vercel Cron retries never double-generate.
 *
 * Auth: Bearer ${CRON_SECRET} (isAuthorizedCron), same as the sibling crons.
 */
export async function GET(req: Request)  { return handle(req); }
export async function POST(req: Request) { return handle(req); }

async function handle(req: Request) {
  if (!isAuthorizedCron(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !supaUrl) {
    return NextResponse.json({ error: "supabase_misconfigured" }, { status: 500 });
  }
  const supabase = createSupabaseClient(supaUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const nowUtc = new Date();

  // Every user's prefs; the local-hour check below filters to ~1/24 per tick,
  // and checkAiBudget() filters to Pro users. No dependence on any optional
  // opt-in column, so this works regardless of settings-schema drift.
  const { data: prefs, error: prefsErr } = await supabase
    .from("user_preferences")
    .select("user_id, language, timezone, digest_send_hour");
  if (prefsErr) {
    return NextResponse.json({ error: prefsErr.message }, { status: 500 });
  }

  const results: Array<{ user_id: string; status: string; detail?: string }> = [];
  for (const pref of prefs ?? []) {
    const tz = pref.timezone || "UTC";
    if (currentHourInTz(nowUtc, tz) !== (pref.digest_send_hour ?? 7)) continue;

    const language = (pref.language ?? "en") as LanguageCode;
    const today = localDateKey(nowUtc, tz);

    // Idempotency: skip if today's edition already exists in this language.
    const { data: existing } = await supabase
      .from("daily_editions")
      .select("user_id")
      .eq("user_id", pref.user_id)
      .eq("edition_date", today)
      .eq("language", language)
      .maybeSingle();
    if (existing) { results.push({ user_id: pref.user_id, status: "exists" }); continue; }

    // Same Pro-plan + budget gate as the interactive route.
    const budget = await checkAiBudget(pref.user_id, "daily_edition");
    if (!budget.ok) { results.push({ user_id: pref.user_id, status: "skipped_plan_or_budget" }); continue; }

    const gen = await generateDailyEdition({ supabase, userId: pref.user_id, tz, language });
    results.push({
      user_id: pref.user_id,
      status: gen.ok ? "generated" : "error",
      detail: gen.ok ? undefined : gen.error,
    });
  }

  return NextResponse.json({
    ok: true,
    generated: results.filter((r) => r.status === "generated").length,
    total: results.length,
    results,
  });
}

function currentHourInTz(now: Date, tz: string): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    hour12: false,
  });
  const h = fmt.formatToParts(now).find((p) => p.type === "hour")?.value ?? "0";
  // Intl returns 24 for midnight in some impls — normalize to 0.
  const n = parseInt(h, 10);
  return n === 24 ? 0 : n;
}
