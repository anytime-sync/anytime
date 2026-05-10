import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { isAdmin } from "@/lib/feature-flags";
import { isOwner } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/users
 *
 * Returns a list of users with their effective plan (manual override > Stripe > free)
 * for the admin members management page. Requires the caller's email to be
 * in ADMIN_EMAILS.
 *
 * Response also includes:
 *   - override_plan_raw: the raw plan from plan_overrides ('vip', 'free', etc.) so
 *     the admin UI can distinguish a VIP comp from a regular Pro override.
 *   - viewer_is_owner: true only if the caller is the canonical owner. The UI
 *     uses this to show/hide the VIP option in the dropdown.
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

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100", 10) || 100, 500);
  const search = url.searchParams.get("q")?.toLowerCase() ?? "";
  const viewerIsOwner = isOwner(auth.user.email);

  try {
    const sb = service();
    const { data: usersList, error: usersErr } = await sb.auth.admin.listUsers({
      page: 1,
      perPage: limit,
    });
    if (usersErr) throw usersErr;
    const users = usersList.users ?? [];

    const ids = users.map((u) => u.id);
    const [planRes, overrideRes] = await Promise.all([
      sb
        .from("user_plans")
        .select(
          "user_id, plan, status, current_period_end, cancel_at_period_end, is_manual_override, override_reason, override_expires_at"
        )
        .in("user_id", ids),
      sb
        .from("plan_overrides")
        .select("user_id, plan, reason, expires_at")
        .in("user_id", ids),
    ]);
    type Row = NonNullable<typeof planRes.data>[number];
    const planMap = new Map<string, Row>(
      (planRes.data ?? []).map((p) => [p.user_id as string, p])
    );
    const overrideMap = new Map<string, { plan: string; reason: string | null; expires_at: string | null }>(
      (overrideRes.data ?? []).map((o) => [
        o.user_id as string,
        { plan: o.plan as string, reason: (o.reason ?? null) as string | null, expires_at: (o.expires_at ?? null) as string | null },
      ])
    );

    let rows = users.map((u) => {
      const p = planMap.get(u.id);
      const ov = overrideMap.get(u.id);
      return {
        id: u.id,
        email: u.email ?? null,
        full_name: (u.user_metadata as { full_name?: string } | null)?.full_name ?? null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        plan: p?.plan ?? "free",
        plan_status: p?.status ?? null,
        current_period_end: p?.current_period_end ?? null,
        cancel_at_period_end: !!p?.cancel_at_period_end,
        is_manual_override: !!p?.is_manual_override,
        override_plan_raw: ov?.plan ?? null,
        override_reason: ov?.reason ?? p?.override_reason ?? null,
        override_expires_at: ov?.expires_at ?? p?.override_expires_at ?? null,
      };
    });

    if (search) {
      rows = rows.filter(
        (r) =>
          (r.email ?? "").toLowerCase().includes(search) ||
          (r.full_name ?? "").toLowerCase().includes(search)
      );
    }

    return NextResponse.json({
      users: rows,
      total: usersList.total ?? rows.length,
      viewer_is_owner: viewerIsOwner,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("[admin/users]", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
