import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { parseLinks } from "@/lib/notes";
import { snippetForNote, syncEmbedding } from "@/lib/embeddings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: { id: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("id", ctx.params.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ note: data });
}

export async function PATCH(
  req: Request,
  ctx: { params: { id: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let patch: {
    title?: string | null;
    body?: string;
    project_id?: string | null;
    task_id?: string | null;
    group_id?: string | null;
    pinned?: boolean;
    archived?: boolean;
  };
  try {
    patch = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const update: Record<string, unknown> = { ...patch };
  if (typeof patch.body === "string") {
    update.links_to = parseLinks(patch.body);
  }

  const { data, error } = await supabase
    .from("notes")
    .update(update)
    .eq("id", ctx.params.id)
    .eq("user_id", user.id)
    .select()
    .single();
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "update_failed" },
      { status: 500 }
    );
  }

  // Re-embed if content changed
  if (typeof patch.body === "string" || typeof patch.title !== "undefined") {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (serviceKey && supaUrl) {
      const service = createServiceClient(supaUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      void syncEmbedding({
        supabase: service,
        userId: user.id,
        sourceType: "note",
        sourceId: data.id,
        content: snippetForNote(data),
      }).catch((e) => console.error("[notes PATCH] embed", e));
    }
  }

  return NextResponse.json({ note: data });
}

export async function DELETE(
  _req: Request,
  ctx: { params: { id: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("notes")
    .delete()
    .eq("id", ctx.params.id)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Drop embedding too (service-role for RLS bypass).
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (serviceKey && supaUrl) {
    const service = createServiceClient(supaUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await service
      .from("search_embeddings")
      .delete()
      .eq("user_id", user.id)
      .eq("source_type", "note")
      .eq("source_id", ctx.params.id);
  }

  return NextResponse.json({ ok: true });
}
