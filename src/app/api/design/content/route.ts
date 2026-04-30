import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PUT    /api/design/content — upsert per-locale text override
 * DELETE /api/design/content — clear an override (revert to default)
 *
 * Body shape: { locale: string, key: string, value?: string }
 *
 * Why this exists: the /admin/design editor used to write to
 * `site_content` with the browser-side Supabase client, but RLS on
 * that table references `auth.users`, and the anon role doesn't have
 * SELECT on `users` — so the upsert came back as
 * "permission denied for table users". Routing through this server
 * endpoint with the service-role client bypasses RLS entirely after
 * we verify the caller is an admin.
 */

type Body = { locale?: unknown; key?: unknown; value?: unknown };

export async function PUT(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const locale = typeof body.locale === "string" ? body.locale : null;
  const key = typeof body.key === "string" ? body.key : null;
  const value = typeof body.value === "string" ? body.value.trim() : "";
  if (!locale || !key) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  // Empty value → delete (revert to default).
  if (!value) {
    const { error } = await auth.ctx.admin
      .from("site_content")
      .delete()
      .eq("locale", locale)
      .eq("key", key);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, deleted: true });
  }
  const { error } = await auth.ctx.admin.from("site_content").upsert({
    locale,
    key,
    value,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const url = new URL(req.url);
  const locale = url.searchParams.get("locale");
  const key = url.searchParams.get("key");
  if (!locale || !key) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  const { error } = await auth.ctx.admin
    .from("site_content")
    .delete()
    .eq("locale", locale)
    .eq("key", key);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
