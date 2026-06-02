/**
 * v1/ai/_lib/ai-handler.ts — shared handler factory for v1 AI routes.
 *
 * Each v1 AI route is a thin wrapper: authenticate via PAT, then call
 * the handler with the authenticated userId + supabase client.
 *
 * This avoids duplicating the AI logic from /api/ai/* routes. Instead,
 * each handler pulls the same data, calls the same prompts, returns
 * the same shape — just with Bearer auth instead of session auth.
 */

import { NextRequest } from "next/server";
import { requireApiAuth, jsonError, jsonOk } from "../../_lib/auth";
import { createClient as createSupabaseServiceClient } from "@supabase/supabase-js";
import { getAnthropic, MODELS } from "@/lib/anthropic";
import { checkAiBudget, logAiCall, type AiFeature } from "@/lib/ai-rate-limit";
import { extractJson } from "@/lib/ai/types";
import type { LanguageCode } from "@/lib/i18n";

export { jsonError, jsonOk };

export interface AiContext {
  userId: string;
  supabase: ReturnType<typeof createSupabaseServiceClient>;
  language: LanguageCode;
  anthropic: ReturnType<typeof getAnthropic>;
}

/**
 * Authenticate + resolve language + check AI budget + get Anthropic client.
 * Returns either a ready-to-use context or an error response.
 */
export async function resolveAiContext(
  req: NextRequest,
  feature: AiFeature,
): Promise<{ ok: true; ctx: AiContext } | { ok: false; response: Response }> {
  const auth = await requireApiAuth(req, "write");
  if (!auth.ok) return { ok: false, response: auth.response };

  const budget = await checkAiBudget(auth.userId, feature);
  if (!budget.ok) {
    return {
      ok: false,
      response: jsonError(429, "rate_limited", `AI budget exceeded for ${feature}.`, {
        used: budget.used,
        limit: budget.limit,
      }),
    };
  }

  const client = getAnthropic();
  if (!client) {
    return { ok: false, response: jsonError(503, "ai_disabled", "AI features are currently disabled.") };
  }

  const { data: prefs } = await auth.supabase
    .from("user_preferences")
    .select("language")
    .eq("user_id", auth.userId)
    .maybeSingle();

  return {
    ok: true,
    ctx: {
      userId: auth.userId,
      supabase: auth.supabase,
      language: (prefs?.language ?? "en") as LanguageCode,
      anthropic: client,
    },
  };
}
