import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/design/upload — image upload to Supabase Storage bucket
 *   `design-assets`. Returns the public URL the editor can drop into
 *   a slot's `bgImageUrl` override.
 *
 * Body: multipart/form-data with `file` (and optional `path`).
 */

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "invalid_form" }, { status: 400 });
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing_file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file_too_large" }, { status: 413 });
  }
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const safeExt = /^[a-z0-9]{1,5}$/.test(ext) ? ext : "bin";
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;

  const buf = await file.arrayBuffer();
  const { error: upErr } = await auth.ctx.admin.storage
    .from("design-assets")
    .upload(path, buf, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  const { data } = auth.ctx.admin.storage
    .from("design-assets")
    .getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl, path });
}
