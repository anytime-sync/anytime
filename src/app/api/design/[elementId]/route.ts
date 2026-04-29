import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PUT  /api/design/[elementId]  — upsert overrides JSON for one slot
 * DELETE /api/design/[elementId] — reset (drop the row)
 */

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ elementId: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { elementId } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const overrides = body && typeof body === "object" && "overrides" in body
    ? (body as { overrides: Record<string, unknown> }).overrides
    : null;
  if (!overrides || typeof overrides !== "object") {
    return NextResponse.json({ error: "missing_overrides" }, { status: 400 });
  }
  // Empty object → delete instead of storing junk.
  if (Object.keys(overrides).length === 0) {
    await auth.ctx.admin
      .from("site_design")
      .delete()
      .eq("element_id", elementId);
    return NextResponse.json({ ok: true, deleted: true });
  }
  const { error } = await auth.ctx.admin.from("site_design").upsert({
    element_id: elementId,
    overrides,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ elementId: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { elementId } = await params;
  const { error } = await auth.ctx.admin
    .from("site_design")
    .delete()
    .eq("element_id", elementId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
