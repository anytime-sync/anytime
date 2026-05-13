import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { isAdmin } from "@/lib/feature-flags";
import { isOwner } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PUT /api/admin/users/[id]/plan
 *
 * Body:
 *   { plan: "free"|"plus"|"pro"|"vip"|"team"|null, reason?: string, expires_at?: string|null }
 *
 * Rules:
 *   - Caller must be admin (ADMIN_EMAILS).
 *   - "vip" can only be set by the *owner* (ADMIN_OWNER_EMAIL).
 *   - "pro" cannot be set manually — Pro must come from a real Stripe sub.
 *     Use "vip" to grant Pro-level access without payment.
 *   - "free" forces the user back to Free regardless of Stripe status.
 *   - plan=null deletes the override (revert to Stripe-driven plan or Free).
 */

function service() {
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

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const userId = params.id;
  if (!userId) {
    return NextResponse.json({ error: "missing_user_id" }, { status: 400 });
  }

  let body: {
    plan?: "free" | "pro" | "vip" | "team" | null;
    reason?: string | null;
    expires_at?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const plan = body.plan ?? null;
  if (plan !== null && !["free", "plus", "pro", "vip", "team"].includes(plan)) {
    return NextResponse.json({ error: "bad_plan" }, { status: 400 });
  }
  // Only the owner can grant VIP.
  if (plan === "vip" && !isOwner(auth.user.email)) {
    return NextResponse.json({ error: "vip_requires_owner" }, { status: 403 });
  }
  // Pro is not manually grantable — it must come from Stripe.
  if (plan === "pro") {
    return NextResponse.json(
      {
        error: "pro_requires_stripe",
        hint: "Pro can only be set by a real Stripe subscription. Use 'vip' to comp Pro access without payment.",
      },
      { status: 400 }
    );
  }

  try {
    const sb = service();
    if (plan === null) {
      const { error } = await sb
        .from("plan_overrides")
        .delete()
        .eq("user_id", userId);
      if (error) throw error;
    } else {
      const { error } = await sb.from("plan_overrides").upsert({
        user_id: userId,
        plan,
        reason: body.reason ?? null,
        expires_at: body.expires_at ?? null,
        set_by: auth.user.id,
      });
      if (error) throw error;
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("[admin/users/plan]", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
