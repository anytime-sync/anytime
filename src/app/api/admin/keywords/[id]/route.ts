import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/keywords/[id]
 * Body: { phrase?: string; priority?: 0|1|3|5; quadrant?: q1|q2|q3|q4|null; enabled?: boolean }
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

  let body: {
    phrase?: string;
    priority?: number;
    quadrant?: string | null;
    enabled?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.phrase === "string") patch.phrase = body.phrase.trim();
  if (typeof body.priority === "number") {
    if (![0, 1, 3, 5].includes(body.priority)) {
      return NextResponse.json({ error: "invalid_priority" }, { status: 400 });
    }
    patch.priority = body.priority;
  }
  if (body.quadrant !== undefined) patch.quadrant = body.quadrant;
  if (typeof body.enabled === "boolean") patch.enabled = body.enabled;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "no_changes" }, { status: 400 });
  }

  const { error } = await auth.ctx.admin
    .from("site_priority_keywords")
    .update(patch)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/admin/keywords/[id]
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

  const { error } = await auth.ctx.admin
    .from("site_priority_keywords")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
