import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/members
 *
 * Body: { email: string }
 * Sends a magic-link invite to the given email via Supabase Auth Admin
 * (auth.admin.inviteUserByEmail). The invitee gets a one-time email with
 * a link that creates their account on first click.
 */
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const email = body.email?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  const { data, error } = await auth.ctx.admin.auth.admin.inviteUserByEmail(
    email
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, user_id: data.user?.id });
}
