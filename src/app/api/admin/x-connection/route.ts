import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";
import { X_ACCOUNT, X_BRANDS, X_KEYS, verifyX, type XCredentials } from "@/lib/x-connection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

async function credentials() {
  const auth = await requireAdmin();
  if (!auth.ok) return { response: NextResponse.json({ error: auth.error }, { status: auth.status, headers }) };
  const { data, error } = await auth.ctx.admin.from("ops_secrets").select("key,value").in("key", [...X_KEYS]);
  if (error) return { response: NextResponse.json({ error: "credential_store_unavailable" }, { status: 503, headers }) };
  const entries = Object.fromEntries((data ?? []).map((row) => [row.key, row.value]));
  const missing = X_KEYS.filter((key) => typeof entries[key] !== "string" || !entries[key].trim());
  return { keys: entries as XCredentials, missing };
}

export async function GET() {
  const result = await credentials();
  if (result.response) return result.response;
  return NextResponse.json({
    account: X_ACCOUNT,
    brands: X_BRANDS,
    configured: result.missing.length === 0,
    missing: result.missing,
    verification: "not_checked",
    billingUrl: "https://console.x.com/",
    automaticPosting: false,
  }, { headers });
}

export async function POST(req: NextRequest) {
  if (req.headers.get("origin") !== new URL(req.url).origin) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403, headers });
  }
  const result = await credentials();
  if (result.response) return result.response;
  if (result.missing.length) {
    return NextResponse.json({ state: "not_configured", missing: result.missing }, { status: 503, headers });
  }
  const status = await verifyX(result.keys);
  return NextResponse.json({ ...status, checkedAt: new Date().toISOString() }, { headers });
}
