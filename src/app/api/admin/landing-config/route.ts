import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { isAdmin } from "@/lib/feature-flags";
import { isOwner } from "@/lib/plans";
import { withDefaults, type LandingConfig } from "@/lib/landing-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin landing-config endpoint. GET returns the raw stored config (no merge),
 * PUT replaces it. Owner-only — only the canonical admin can edit landing copy.
 */

function service() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("supabase_misconfigured");
  return createServiceClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function requireOwner() {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { error: "unauthorized", status: 401 as const };
  if (!isAdmin(user.email)) return { error: "forbidden", status: 403 as const };
  if (!isOwner(user.email)) return { error: "owner_only", status: 403 as const };
  return { user };
}

export async function GET() {
  const auth = await requireOwner();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  try {
    const sb = service();
    const { data, error } = await sb
      .from("landing_config")
      .select("config, updated_at, updated_by")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw error;
    const raw = (data?.config as LandingConfig | null) ?? null;
    return NextResponse.json({
      raw,
      merged: withDefaults(raw),
      updated_at: data?.updated_at ?? null,
      defaults: withDefaults(null),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

export async function PUT(req: Request) {
  const auth = await requireOwner();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  let body: { config?: LandingConfig };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  if (!body.config || typeof body.config !== "object") {
    return NextResponse.json({ error: "missing_config" }, { status: 400 });
  }
  try {
    const sb = service();
    const { error } = await sb
      .from("landing_config")
      .upsert({ id: 1, config: body.config, updated_by: auth.user.id });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
