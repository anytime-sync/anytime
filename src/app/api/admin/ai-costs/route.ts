import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { isAdmin } from "@/lib/feature-flags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function supaService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("supabase_misconfigured");
  return createServiceClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function requireAdmin() {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { error: "unauthorized", status: 401 as const };
  if (!isAdmin(user.email)) return { error: "forbidden", status: 403 as const };
  return { user };
}

/**
 * GET /api/admin/ai-costs
 *
 * Returns AI usage cost summary for the last N days.
 * Query params:
 *   days=30 (default) — lookback window
 *   group=feature|user|model|day (default: feature)
 */
export async function GET(req: Request) {
  const auth = await requireAdmin();
  if ("error" in auth)
    return NextResponse.json({ error: auth.error }, { status: auth.status });

  const url = new URL(req.url);
  const days = Math.min(parseInt(url.searchParams.get("days") || "30", 10), 90);
  const group = url.searchParams.get("group") || "feature";

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const sinceIso = since.toISOString();

  const supa = supaService();

  // Summary totals
  const { data: totals } = await supa.rpc("ai_cost_summary", { since_ts: sinceIso });

  // If RPC not available, fall back to raw query
  const { data: rows, error } = await supa
    .from("ai_usage_log")
    .select("feature, model, user_id, input_tokens, output_tokens, estimated_cost_usd, created_at")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Aggregate by group
  const agg = new Map<string, { calls: number; inputTokens: number; outputTokens: number; costUsd: number }>();

  for (const r of rows || []) {
    let key: string;
    switch (group) {
      case "user":
        key = r.user_id;
        break;
      case "model":
        key = r.model || "unknown";
        break;
      case "day":
        key = r.created_at?.slice(0, 10) || "unknown";
        break;
      default:
        key = r.feature;
    }

    const existing = agg.get(key) || { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
    existing.calls++;
    existing.inputTokens += r.input_tokens || 0;
    existing.outputTokens += r.output_tokens || 0;
    existing.costUsd += parseFloat(r.estimated_cost_usd) || 0;
    agg.set(key, existing);
  }

  const summary = Array.from(agg.entries())
    .map(([key, val]) => ({ key, ...val, costUsd: Math.round(val.costUsd * 1_000_000) / 1_000_000 }))
    .sort((a, b) => b.costUsd - a.costUsd);

  const totalCost = summary.reduce((s, r) => s + r.costUsd, 0);
  const totalCalls = summary.reduce((s, r) => s + r.calls, 0);

  return NextResponse.json({
    days,
    group,
    totalCalls,
    totalCostUsd: Math.round(totalCost * 100) / 100,
    breakdown: summary,
  });
}