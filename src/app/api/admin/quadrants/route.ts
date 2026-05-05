import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/quadrants?locale=xx
 * List the per-quadrant config rows for a locale (label + colors).
 */
export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const url = new URL(req.url);
  const locale = url.searchParams.get("locale") ?? "en";

  const { data, error } = await auth.ctx.admin
    .from("site_quadrant_config")
    .select("locale, quadrant, label, fg_color, bg_color, border_color")
    .eq("locale", locale);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ rows: data });
}

/**
 * POST /api/admin/quadrants
 * Body: { locale, quadrant, label, fg_color, bg_color, border_color }
 * Upsert the row for that (locale, quadrant) pair.
 */
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: {
    locale?: string;
    quadrant?: string;
    label?: string;
    fg_color?: string | null;
    bg_color?: string | null;
    border_color?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const locale = (body.locale ?? "").trim();
  const quadrant = (body.quadrant ?? "").trim();
  if (!locale || !["q1", "q2", "q3", "q4"].includes(quadrant)) {
    return NextResponse.json({ error: "invalid_fields" }, { status: 400 });
  }

  const row = {
    locale,
    quadrant,
    label: body.label ?? "",
    fg_color: body.fg_color ?? null,
    bg_color: body.bg_color ?? null,
    border_color: body.border_color ?? null,
  };

  const { error } = await auth.ctx.admin
    .from("site_quadrant_config")
    .upsert(row, { onConflict: "locale,quadrant" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
