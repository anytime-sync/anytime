import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { requireAdmin } from "@/lib/admin-server";
import { ADMIN_EMAIL } from "@/lib/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/impersonate/start
 * Body: { user_id: string }
 *
 * Same-tab impersonation via cookie swap. Stashes the admin's existing
 * Supabase auth cookies under `fl.adm.<name>` so /stop can restore
 * them, then exchanges a single-use magic-link OTP for the target
 * user. The verifyOtp call writes the target's tokens into the regular
 * `sb-*-auth-token` cookies, so any subsequent request from this
 * browser is now authenticated as the target user.
 *
 * Sets a public marker cookie `fl.imp.target_email` so the
 * impersonation banner can render client-side without a round-trip.
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

  // Capture the admin's user.id BEFORE we swap, for the audit log.
  let adminUserId: string | null = null;
  try {
    const ssrPre = await createServerClient();
    const { data: meData } = await ssrPre.auth.getUser();
    adminUserId = meData?.user?.id ?? null;
  } catch {
    // best-effort; audit log will record null if this fails
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

  // Snapshot the admin's Supabase auth cookies. We DON'T delete them
  // yet — we mirror them under the fl.adm. prefix. The verifyOtp call
  // below will then overwrite the original sb-* cookies with the
  // target user's tokens.
  const cookieStore = await cookies();
  const adminSnapshot: Array<{ name: string; value: string }> = [];
  for (const c of cookieStore.getAll()) {
    if (c.name.startsWith("sb-") && c.name.includes("auth-token")) {
      adminSnapshot.push({ name: c.name, value: c.value });
    }
  }
  if (adminSnapshot.length === 0) {
    return NextResponse.json(
      { error: "no_admin_session_to_save" },
      { status: 500 }
    );
  }
  const baseCookieOpts = {
    maxAge: 30 * 24 * 60 * 60,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: true,
    path: "/",
  };
  for (const s of adminSnapshot) {
    cookieStore.set(`fl.adm.${s.name}`, s.value, baseCookieOpts);
  }
  // Public marker — the banner reads this to show "impersonating
  // <email>" without a round-trip.
  cookieStore.set("fl.imp.target_email", targetEmail, {
    ...baseCookieOpts,
    httpOnly: false,
  });
  cookieStore.set("fl.imp.target_id", targetId, baseCookieOpts);

  // Generate a single-use OTP for the target user via the admin API.
  const { data: linkData, error: linkErr } =
    await auth.ctx.admin.auth.admin.generateLink({
      type: "magiclink",
      email: targetEmail,
    });
  if (linkErr || !linkData?.properties?.hashed_token) {
    return NextResponse.json(
      { error: linkErr?.message ?? "link_generation_failed" },
      { status: 500 }
    );
  }

  // Exchange the OTP for a real session. verifyOtp writes the new sb-*
  // cookies into our cookieStore, replacing the admin's session.
  const ssr = await createServerClient();
  const { data: verifyData, error: verifyErr } = await ssr.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: "magiclink",
  });
  if (verifyErr || !verifyData?.session) {
    // Roll back the snapshot so the admin doesn't end up signed out.
    for (const s of adminSnapshot) {
      cookieStore.set(s.name, s.value, baseCookieOpts);
    }
    cookieStore.delete("fl.imp.target_email");
    cookieStore.delete("fl.imp.target_id");
    for (const s of adminSnapshot) {
      cookieStore.delete(`fl.adm.${s.name}`);
    }
    return NextResponse.json(
      { error: verifyErr?.message ?? "verify_failed" },
      { status: 500 }
    );
  }

  // Audit log.
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ua = hdrs.get("user-agent") ?? null;
  await auth.ctx.admin.from("admin_impersonation_log").insert({
    admin_user_id: adminUserId,
    target_user_id: targetId,
    ip,
    user_agent: ua,
  });

  return NextResponse.json({
    ok: true,
    target_email: targetEmail,
    redirect: "/app",
  });
}
