/**
 * GET    /api/v1/events/{id}
 * PATCH  /api/v1/events/{id}
 * DELETE /api/v1/events/{id}
 */

import { NextRequest } from "next/server";
import { requireApiAuth, jsonError, jsonOk } from "../../_lib/auth";

type Params = { params: { id: string } };

export async function GET(req: NextRequest, { params }: Params) {
  const ctx = await requireApiAuth(req, "read");
  if (!ctx.ok) return ctx.response;
  const { data, error } = await ctx.supabase
    .from("calendar_events")
    .select("*")
    .eq("user_id", ctx.userId)
    .eq("id", params.id)
    .maybeSingle();
  if (error) return jsonError(500, "db_error", error.message);
  if (!data) return jsonError(404, "not_found", "Event not found.");
  return jsonOk({ data });
}

interface PatchBody {
  title?: string;
  description?: string | null;
  location?: string | null;
  start_at?: string;
  end_at?: string;
  all_day?: boolean;
  task_id?: string | null;
}
const ALLOWED: (keyof PatchBody)[] = [
  "title",
  "description",
  "location",
  "start_at",
  "end_at",
  "all_day",
  "task_id",
];

export async function PATCH(req: NextRequest, { params }: Params) {
  const ctx = await requireApiAuth(req, "write");
  if (!ctx.ok) return ctx.response;

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return jsonError(400, "invalid_json", "Body must be valid JSON.");
  }
  const patch: Record<string, unknown> = {};
  for (const k of ALLOWED) {
    if (k in body) patch[k] = (body as Record<string, unknown>)[k];
  }
  if (Object.keys(patch).length === 0) {
    return jsonError(400, "no_fields", "At least one updatable field is required.");
  }

  const { data, error } = await ctx.supabase
    .from("calendar_events")
    .update(patch)
    .eq("user_id", ctx.userId)
    .eq("id", params.id)
    .select("*")
    .single();
  if (error) return jsonError(500, "db_error", error.message);
  if (!data) return jsonError(404, "not_found", "Event not found.");
  return jsonOk({ data });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const ctx = await requireApiAuth(req, "write");
  if (!ctx.ok) return ctx.response;
  const { error } = await ctx.supabase
    .from("calendar_events")
    .delete()
    .eq("user_id", ctx.userId)
    .eq("id", params.id);
  if (error) return jsonError(500, "db_error", error.message);
  return jsonOk({ deleted: true });
}

