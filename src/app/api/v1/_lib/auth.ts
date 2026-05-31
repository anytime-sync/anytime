/**
 * Shared auth + plan gate for every /api/v1/* route handler.
 *
 * Usage in a route handler:
 *
 *   import { requireApiAuth, jsonError } from "../_lib/auth";
 *   export async function GET(req: NextRequest) {
 *     const ctx = await requireApiAuth(req, "read");
 *     if (!ctx.ok) return ctx.response;
 *     // ctx.userId is the authenticated First Light user.
 *     // ctx.supabase is a service-role client; queries should still
 *     // filter by user_id to keep the surface small.
 *     ...
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { validatePAT, type Scope } from "@/lib/pat";
// If your project uses a different plans/feature helper, adjust this import:
import { PLAN_FEATURES } from "@/lib/plans";

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

export function jsonError(
  status: number,
  code: string,
  message: string,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json(
    { error: { code, message, ...(extra ?? {}) } },
    { status },
  );
}

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

// ---------------------------------------------------------------------------
// Auth result type
// ---------------------------------------------------------------------------

export type AuthOk = {
  ok: true;
  userId: string;
  scopes: Scope[];
  /** Service-role client. Always include `.eq('user_id', userId)` in queries. */
  supabase: SupabaseClient;
};

export type AuthFail = {
  ok: false;
  response: ReturnType<typeof jsonError>;
};

// ---------------------------------------------------------------------------
// Plan gate
// ---------------------------------------------------------------------------

/** Looks up the user's effective plan and confirms `apiAccess` is enabled. */
async function assertPlanAllowsApi(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  // Adjust this query to match how you read effective plan elsewhere
  // (e.g. via your existing /api/feature-flags/effective logic).
  const { data, error } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", userId)
    .single();
  if (error || !data) return false;
  const plan = (data.plan as string) ?? "free";

  // PLAN_FEATURES.apiAccess[plan] is what the plans-patch.md row provides.
  const feature = (PLAN_FEATURES as Record<string, Record<string, boolean>>)
    .apiAccess;
  if (!feature) return false;
  return Boolean(feature[plan]);
}

// ---------------------------------------------------------------------------
// Rate limiting (simple per-user, per-minute leaky bucket via Supabase)
// ---------------------------------------------------------------------------

const RATE_LIMIT_PER_MIN = 120; // Pro tier; tune per plan if needed

async function rateLimitOk(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  // Cheap implementation: count rows in `api_request_log` for this user in
  // the last 60s. If you already have a rate-limit primitive (you mentioned
  // one for AI calls), call that instead.
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count, error } = await supabase
    .from("api_request_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);
  if (error) return true; // fail-open on the rate-limit table missing
  return (count ?? 0) < RATE_LIMIT_PER_MIN;
}

async function logRequest(
  supabase: SupabaseClient,
  userId: string,
  req: NextRequest,
) {
  await supabase.from("api_request_log").insert({
    user_id: userId,
    method: req.method,
    path: new URL(req.url).pathname,
  });
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function requireApiAuth(
  req: NextRequest,
  required: Scope = "read",
): Promise<AuthOk | AuthFail> {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (!match) {
    return {
      ok: false,
      response: jsonError(
        401,
        "missing_token",
        "Authorization: Bearer <token> header required.",
      ),
    };
  }
  const raw = match[1];

  const validation = await validatePAT(raw);
  if (!validation) {
    return {
      ok: false,
      response: jsonError(401, "invalid_token", "Token is invalid, expired, or revoked."),
    };
  }

  if (!validation.scopes.includes(required)) {
    return {
      ok: false,
      response: jsonError(
        403,
        "insufficient_scope",
        `Token is missing required scope: ${required}`,
        { required, granted: validation.scopes },
      ),
    };
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const planOk = await assertPlanAllowsApi(supabase, validation.userId);
  if (!planOk) {
    return {
      ok: false,
      response: jsonError(
        402,
        "upgrade_required",
        "Public API access is a Pro-tier feature. Upgrade at firstlight.to/pricing.",
      ),
    };
  }

  const underLimit = await rateLimitOk(supabase, validation.userId);
  if (!underLimit) {
    return {
      ok: false,
      response: jsonError(
        429,
        "rate_limited",
        `You've exceeded ${RATE_LIMIT_PER_MIN} requests/minute. Back off and retry.`,
      ),
    };
  }

  // Fire-and-forget log; do not await to avoid blocking the response.
  logRequest(supabase, validation.userId, req).catch(() => {});

  return {
    ok: true,
    userId: validation.userId,
    scopes: validation.scopes,
    supabase,
  };
}

