import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";
import { ADMIN_EMAIL } from "@/lib/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/impersonate/start
 * Body: { user_id: string }
 *
 * Generates a single-use magic-link for the target user (via Supabase
 * Auth admin API), records the action in `admin_impersonation_log`,
 * and returns the URL. Open that URL in a new tab to sign in as the
 * target user — closing the tab signs back out, so the admin&rsquo;s
 * own session is never touched.
 *
 * Why magic-link-in-new-tab instead of cookie swap:
 *   - Cookie swap means juggling Supabase&rsquo;s `sb-*-auth-token`
 *     cookies and risking permanent loss of the admin session if the
 *     swap-back fails. New-tab is bulletproof.
 *   - Admin can keep both sessions side-by-side, useful for
 *     comparison.
 */
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: { user_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const targetId = (body.user_id ?? "").trim();
  if (!targetId) {
    return NextResponse.json({ error: "missing_user_id" }, { status: 400 });
  }

  const { data: targetData, error: lookupErr } =
    await auth.ctx.admin.auth.admin.getUserById(targetId);
  if (lookupErr || !targetData?.user?.email) {
    return NextResponse.json(
      { error: lookupErr?.message ?? "user_not_found" },
      { status: 404 }
    );
  }
  const targetEmail = targetData.user.email;
  if (targetEmail.toLowerCase().trim() === ADMIN_EMAIL) {
    return NextResponse.json(
      { error: "cannot_impersonate_self" },
      { status: 400 }
    );
  }

  const hdrs = await headers();
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    `https://${hdrs.get("host") ?? "firstlight.to"}`;

  const { data: linkData, error: linkErr } =
    await auth.ctx.admin.auth.admin.generateLink({
      type: "magiclink",
      email: targetEmail,
      options: { redirectTo: `${baseUrl}/auth/callback?next=/app` },
    });
  if (linkErr || !linkData?.properties?.action_link) {
    return NextResponse.json(
      { error: linkErr?.message ?? "link_generation_failed" },
      { status: 500 }
    );
  }

  // Audit log: who impersonated whom, from where.
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ua = hdrs.get("user-agent") ?? null;
  const ssr = await createServerClient();
  const {
    data: { user: meUser },
  } = await ssr.auth.getUser();

  await auth.ctx.admin.from("admin_impersonation_log").insert({
    admin_user_id: meUser?.id ?? null,
    target_user_id: targetId,
    ip,
    user_agent: ua,
  });

  return NextResponse.json({
    ok: true,
    url: linkData.properties.action_link,
    target_email: targetEmail,
  });
}
