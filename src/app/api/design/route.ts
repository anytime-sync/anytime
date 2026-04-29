import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/design — return the full site_design map. Used by the
 * /admin/design editor (parent window) and as a fallback fetch.
 *
 * PUT /api/design — bulk upsert. Body: { [elementId]: overrides }.
 *   - Empty/null overrides delete the row.
 */

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { data, error } = await auth.ctx.admin
    .from("site_design")
    .select("element_id, overrides");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const map: Record<string, unknown> = {};
  for (const row of (data ?? []) as Array<{ element_id: string; overrides: unknown }>) {
    map[row.element_id] = row.overrides;
  }
  return NextResponse.json({ map });
}
