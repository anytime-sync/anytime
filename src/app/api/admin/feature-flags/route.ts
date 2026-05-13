import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { isAdmin, invalidateFlagCache } from "@/lib/feature-flags";
import { getFeature } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Round Z2 admin: GET/PUT for /api/admin/feature-flags.
 *
 * Auth: must be a signed-in user whose email is in ADMIN_EMAILS env.
 *
 * GET  → returns all rows from public.feature_flags (admin-only).
 * PUT  → upserts a single override:
 *          { feature_id, override_plan?: 'free'|'pro'|'team'|null, disabled?: boolean, note?: string }
 *        Setting override_plan=null AND disabled=false effectively deletes the
 *        row (we delete it server-side so the table stays sparse).
 */

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

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  try {
    const sb = supaService();
    const { data, error } = await sb
      .from("feature_flags")
      .select("feature_id,override_plan,disabled,note,updated_at,updated_by")
      .order("feature_id");
    if (error) throw error;
    return NextResponse.json({ flags: data ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

export async function PUT(req: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: {
    feature_id?: string;
    override_plan?: "free" | "pro" | "vip" | "team" | null;
    disabled?: boolean;
    note?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const id = body.feature_id;
  if (!id) return NextResponse.json({ error: "missing_feature_id" }, { status: 400 });
  if (!getFeature(id)) {
    return NextResponse.json(
      { error: "unknown_feature", id },
      { status: 400 }
    );
  }
  const override_plan = body.override_plan ?? null;
  if (
    override_plan !== null &&
    !["free", "pro", "vip", "team"].includes(override_plan)
  ) {
    return NextResponse.json({ error: "bad_override_plan" }, { status: 400 });
  }
  const disabled = !!body.disabled;
  const note = body.note ?? null;

  try {
    const sb = supaService();
    // If both override_plan is null and disabled is false (a "no-op"), delete
    // the row so the table stays sparse and getEffectiveFeature falls back to
    // code default.
    if (override_plan === null && !disabled && !note) {
      await sb.from("feature_flags").delete().eq("feature_id", id);
    } else {
      const { error } = await sb.from("feature_flags").upsert({
        feature_id: id,
        override_plan,
        disabled,
        note,
        updated_by: auth.user.id,
      });
      if (error) throw error;
    }
    invalidateFlagCache();
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
