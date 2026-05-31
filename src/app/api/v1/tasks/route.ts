/**
 * GET  /api/v1/tasks
 *   List tasks. Filters: ?status=open|done|archived  ?from=YYYY-MM-DD
 *   ?to=YYYY-MM-DD  ?priority=low|med|high  ?project=<id>
 *   ?limit=1..200 (default 50)  ?cursor=<id> for pagination.
 *
 * POST /api/v1/tasks
 *   Create a task. Body: { title, due_at?, start_at?, priority?, notes?,
 *   project_id?, status? }
 */

import { NextRequest } from "next/server";
import { requireApiAuth, jsonError, jsonOk } from "../_lib/auth";

// --- GET --------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const ctx = await requireApiAuth(req, "read");
  if (!ctx.ok) return ctx.response;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(
    Math.max(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 1),
    200,
  );
  const status = searchParams.get("status");
  const priority = searchParams.get("priority");
  const projectId = searchParams.get("project");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const cursor = searchParams.get("cursor");

  let q = ctx.supabase
    .from("tasks")
    .select(
      "id,title,status,priority,due_at,start_at,notes,project_id,created_at,updated_at,completed_at",
    )
    .eq("user_id", ctx.userId)
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) q = q.eq("status", status);
  if (priority) q = q.eq("priority", priority);
  if (projectId) q = q.eq("project_id", projectId);
  if (from) q = q.gte("due_at", from);
  if (to) q = q.lte("due_at", to);
  if (cursor) q = q.lt("id", cursor); // simple id-cursor pagination

  const { data, error } = await q;
  if (error) return jsonError(500, "db_error", error.message);

  return jsonOk({
    data,
    pagination: {
      limit,
      next_cursor: data && data.length === limit ? data[data.length - 1].id : null,
    },
  });
}

// --- POST -------------------------------------------------------------------

interface CreateTaskBody {
  title: string;
  due_at?: string | null;
  start_at?: string | null;
  priority?: "low" | "med" | "high" | null;
  notes?: string | null;
  project_id?: string | null;
  status?: "open" | "done" | "archived";
}

export async function POST(req: NextRequest) {
  const ctx = await requireApiAuth(req, "write");
  if (!ctx.ok) return ctx.response;

  let body: CreateTaskBody;
  try {
    body = (await req.json()) as CreateTaskBody;
  } catch {
    return jsonError(400, "invalid_json", "Request body must be valid JSON.");
  }
  if (!body.title || typeof body.title !== "string" || body.title.length > 500) {
    return jsonError(
      400,
      "invalid_title",
      "`title` is required (string, ≤ 500 chars).",
    );
  }

  const { data, error } = await ctx.supabase
    .from("tasks")
    .insert({
      user_id: ctx.userId,
      title: body.title,
      due_at: body.due_at ?? null,
      start_at: body.start_at ?? null,
      priority: body.priority ?? null,
      notes: body.notes ?? null,
      project_id: body.project_id ?? null,
      status: body.status ?? "open",
    })
    .select("*")
    .single();

  if (error) return jsonError(500, "db_error", error.message);
  return jsonOk({ data }, { status: 201 });
}

