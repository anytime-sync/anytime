/**
 * GET  /api/v1/tags         — list all tags for the user
 * POST /api/v1/tags         — create a tag { name, color? }
 */

import { NextRequest } from "next/server";
import { requireApiAuth, jsonError, jsonOk } from "../_lib/auth";

export async function GET(req: NextRequest) {
  const ctx = await requireApiAuth(req, "read");
  if (!ctx.ok) return ctx.response;

  const { data, error } = await ctx.supabase
    .from("tags")
    .select("id, name, color, parent_id, created_at")
    .eq("user_id", ctx.userId)
    .order("name", { ascending: true });

  if (error) return jsonError(500, "db_error", error.message);
  return jsonOk({ data });
}

export async function POST(req: NextRequest) {
  const ctx = await requireApiAuth(req, "write");
  if (!ctx.ok) return ctx.response;

  let body: { name?: string; color?: string };
  try {
    body = (await req.json()) as { name?: string; color?: string };
  } catch {
    return jsonError(400, "invalid_json", "Request body must be valid JSON.");
  }

  if (!body.name || typeof body.name !== "string" || body.name.trim().length === 0) {
    return jsonError(400, "missing_name", "Tag name is required.");
  }

  const name = body.name.trim().toLowerCase();
  const color = body.color ?? "#6366f1"; // default indigo

  // Check if tag already exists
  const { data: existing } = await ctx.supabase
    .from("tags")
    .select("id, name, color")
    .eq("user_id", ctx.userId)
    .eq("name", name)
    .maybeSingle();

  if (existing) {
    return jsonOk({ data: existing, created: false });
  }

  const { data, error } = await ctx.supabase
    .from("tags")
    .insert({ user_id: ctx.userId, name, color })
    .select("id, name, color, parent_id, created_at")
    .single();

  if (error) return jsonError(500, "db_error", error.message);
  return jsonOk({ data, created: true }, { status: 201 });
}

