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
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { error: "unauthorized", status: 401 as const };
  if (!isAdmin(user.email)) return { error: "forbidden", status: 403 as const };
  return { user };
}

/**
 * GET /api/admin/service-prices
 * Returns the current pricing configuration.
 */
export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  try {
    const sb = supaService();
    const { data, error } = await sb
      .from("service_prices")
      .select("plus_cents,pro_cents,currency,updated_at,updated_by")
      .eq("id", "singleton")
      .single();
    if (error) throw error;
    return NextResponse.json({ prices: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

/**
 * PUT /api/admin/service-prices
 * Updates pricing. Body: { plus_cents?: number, pro_cents?: number, currency?: string }
 */
export async function PUT(req: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: {
    plus_cents?: number;
    pro_cents?: number;
    currency?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  // Validate
  if (body.plus_cents !== undefined && (typeof body.plus_cents !== "number" || body.plus_cents < 0)) {
    return NextResponse.json({ error: "invalid_plus_cents" }, { status: 400 });
  }
  if (body.pro_cents !== undefined && (typeof body.pro_cents !== "number" || body.pro_cents < 0)) {
    return NextResponse.json({ error: "invalid_pro_cents" }, { status: 400 });
  }
  if (body.currency !== undefined && typeof body.currency !== "string") {
    return NextResponse.json({ error: "invalid_currency" }, { status: 400 });
  }

  try {
    const sb = supaService();
    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: auth.user.id,
    };
    if (body.plus_cents !== undefined) update.plus_cents = body.plus_cents;
    if (body.pro_cents !== undefined) update.pro_cents = body.pro_cents;
    if (body.currency !== undefined) update.currency = body.currency;

    const { error } = await sb
      .from("service_prices")
      .update(update)
      .eq("id", "singleton");
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
