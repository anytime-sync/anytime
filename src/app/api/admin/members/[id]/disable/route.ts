import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/members/[id]/disable  -> ban indefinitely
 * DELETE /api/admin/members/[id]/disable -> lift the ban (re-enable)
 *
 * Supabase Auth supports a `ban_duration` field on the user record. We
 * use a long horizon (876_000h ≈ 100 years) for "disabled". Lifting the
 * ban is just `ban_duration: "none"`. The user's data is preserved.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { id } = await params;

  // 100-year ban; effectively disables the account.
  const { error } = await auth.ctx.admin.auth.admin.updateUserById(id, {
    ban_duration: "876000h",
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { id } = await params;

  const { error } = await auth.ctx.admin.auth.admin.updateUserById(id, {
    ban_duration: "none",
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
