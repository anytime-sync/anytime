import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/members/[id]
 * Body: { full_name?: string; language?: string }
 * Updates profile name + preferred language via the admin_update_member
 * RPC (SECURITY DEFINER, hard-coded admin email check).
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { id } = await params;

  let body: { full_name?: string | null; language?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const { error } = await auth.ctx.admin.rpc("admin_update_member", {
    p_user_id: id,
    p_full_name: body.full_name ?? null,
    p_language: body.language ?? null,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/admin/members/[id]
 * Hard-deletes the user from auth.users. Cascade rules in the schema
 * remove their tasks, pomodoros, profile, etc. Irreversible.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { id } = await params;

  const { error } = await auth.ctx.admin.auth.admin.deleteUser(id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
