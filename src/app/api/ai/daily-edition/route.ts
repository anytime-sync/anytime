import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkAiBudget } from "@/lib/ai-rate-limit";
import { generateDailyEdition, localDateKey } from "@/lib/ai/daily-edition";
import type { LanguageCode } from "@/lib/i18n";

export const runtime = "nodejs";

/**
 * On-demand Daily Edition endpoint. Auth + per-user AI budget + per-language
 * caching live here; the actual generation is shared with the pre-generation
 * cron via generateDailyEdition() in @/lib/ai/daily-edition.
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Per-user daily AI budget check (Anthropic cost guard).
  const __budget = await checkAiBudget(u.user.id, "daily_edition");
  if (!__budget.ok) {
    return NextResponse.json(
      { error: "rate_limited", used: __budget.used, limit: __budget.limit },
      { status: 429, headers: { "Retry-After": String(__budget.retryAfter) } }
    );
  }

  const body = await req.json().catch(() => ({}));
  const tz: string = body.tz || "UTC";
  const force: boolean = !!body.force;
  const today = localDateKey(new Date(), tz);

  // Read user prefs (language). Cache key includes language so switching
  // language regenerates the brief instead of serving stale English.
  const { data: prefs } = await supabase
    .from("user_preferences")
    .select("language")
    .eq("user_id", u.user.id)
    .maybeSingle();
  const language = (prefs?.language ?? "en") as LanguageCode;

  // Per-language cache hit: same user + day + language returns instantly.
  if (!force) {
    const { data: cached } = await supabase
      .from("daily_editions")
      .select("*")
      .eq("user_id", u.user.id)
      .eq("edition_date", today)
      .eq("language", language)
      .maybeSingle();
    if (cached) {
      return NextResponse.json(cached);
    }
  }

  const result = await generateDailyEdition({
    supabase,
    userId: u.user.id,
    tz,
    language,
  });
  if (!result.ok) {
    const error = result.error === "ai_disabled" ? "ai_disabled" : "edition_failed";
    return NextResponse.json(
      { error, detail: result.error },
      { status: result.status }
    );
  }
  return NextResponse.json(result.row);
}
