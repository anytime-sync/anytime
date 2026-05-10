import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { isAdmin } from "@/lib/feature-flags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/users
 *
 * Returns a list of users with their effective plan (manual override > Stripe > free)
 * for the admin members management page. Requires the caller's email to be
 * in ADMIN_EMAILS.
 *
 * We pull from auth.users (admin API) + the user_plans view, joined by user_id.
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

  try {
    const sb = service();
    // List users via the auth admin API.
    const { data: usersList, error: usersErr } = await sb.auth.admin.listUsers({
      page: 1,
      perPage: limit,
    });
    if (usersErr) throw usersErr;
    const users = usersList.users ?? [];

    // Pull plan info for these users in one query.
    const ids = users.map((u) => u.id);
    const { data: plans } = await sb
      .from("user_plans")
      .select(
        "user_id, plan, status, current_period_end, cancel_at_period_end, is_manual_override, override_reason, override_expires_at"
      )
      .in("user_id", ids);
    const planMap = new Map<string, NonNullable<typeof plans>[number]>(
      (plans ?? []).map((p) => [p.user_id as string, p])
    );

    let rows = users.map((u) => {
      const p = planMap.get(u.id);
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
        override_reason: p?.override_reason ?? null,
        override_expires_at: p?.override_expires_at ?? null,
      };
    });

    if (search) {
      rows = rows.filter(
        (r) =>
          (r.email ?? "").toLowerCase().includes(search) ||
          (r.full_name ?? "").toLowerCase().includes(search)
      );
    }

    return NextResponse.json({ users: rows, total: usersList.total ?? rows.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("[admin/users]", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
