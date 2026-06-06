/**
 * GET    /api/v1/tasks/{id}     read a single task
 * PATCH  /api/v1/tasks/{id}     update title/notes/due/priority/status
 * DELETE /api/v1/tasks/{id}     hard-delete (soft-archive: pass status=archived to PATCH)
 */

import { NextRequest } from "next/server";
import { requireApiAuth, jsonError, jsonOk } from "../../_lib/auth";

type Params = { params: { id: string } };

// DB stores priority as integer: 0 (none) | 1 (low) | 3 (med) | 5 (high)
const PRIORITY_MAP: Record<string, number> = {
  none: 0,
  low: 1,
  med: 3,
  medium: 3,
  high: 5,
  "0": 0,
  "1": 1,
  "3": 3,
  "5": 5,
};

function normalizePriority(
  val: string | number | null | undefined,
): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") {
    return [0, 1, 3, 5].includes(val) ? val : null;
  }
  const mapped = PRIORITY_MAP[val.toLowerCase()];
  return mapped !== undefined ? mapped : null;
}

export async function GET(req: NextRequest, { params }: Params) {
  const ctx = await requireApiAuth(req, "read");
  if (!ctx.ok) return ctx.response;

  const { data, error } = await ctx.supabase
    .from("tasks")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (error) return jsonError(500, "db_error", error.message);
  if (!data) return jsonError(404, "not_found", "Task not found.");
  return jsonOk({ data });
}

interface PatchBody {
  title?: string;
  due_at?: string | null;
  start_at?: string | null;
  is_all_day?: boolean | null;
  priority?: string | number | null;
  notes?: string | null;
  status?: "open" | "done" | "archived";
  project_id?: string | null;
}

const ALLOWED: (keyof PatchBody)[] = [
  "title",
  "due_at",
  "start_at",
  "is_all_day",
  "priority",
  "notes",
  "status",
  "project_id",
];

export async function PATCH(req: NextRequest, { params }: Params) {
  const ctx = await requireApiAuth(req, "write");
  if (!ctx.ok) return ctx.response;

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return jsonError(400, "invalid_json", "Request body must be valid JSON.");
  }

  const patch: Record<string, unknown> = {};
  for (const k of ALLOWED) {
    if (k in body) patch[k] = (body as Record<string, unknown>)[k];
  }
  if (Object.keys(patch).length === 0) {
    return jsonError(400, "no_fields", "At least one updatable field is required.");
  }
  if (patch.status === "done") patch.completed_at = new Date().toISOString();
  if (patch.status === "open") patch.completed_at = null;

  // Normalize priority from string labels to DB integer
  if ("priority" in patch) {
    patch.priority = normalizePriority(patch.priority as string | number | null) ?? 0;
  }

  // Auto-derive is_all_day when dates change but is_all_day wasn't explicitly set
  if (("start_at" in patch || "due_at" in patch) && !("is_all_day" in patch)) {
    // Check the raw ISO string for midnight in sender's timezone (not UTC).
    // "T00:00:00+08:00" = midnight Taipei = all-day; "T10:30:00" = timed.
    const midnightRe = /T00:00:00([Z+-]|$)/;
    const dateOnlyRe = /^\d{4}-\d{2}-\d{2}$/;
    const hasTime = (iso: unknown) => {
      if (!iso || typeof iso !== "string") return false;
      return !dateOnlyRe.test(iso) && !midnightRe.test(iso);
    };
    if (hasTime(patch.start_at) || hasTime(patch.due_at)) {
      patch.is_all_day = false;
    }
  }

  // Enforce start <= end invariant. When both dates are present in the
  // patch (or one is being updated against the existing task), clamp
  // so start never exceeds end.
  if ("start_at" in patch || "due_at" in patch) {
    // We need the current row to resolve partial updates.
    const { data: current } = await ctx.supabase
      .from("tasks")
      .select("start_at, due_at")
      .eq("id", params.id)
      .maybeSingle();
    const effectiveStart = "start_at" in patch ? patch.start_at : current?.start_at;
    const effectiveEnd = "due_at" in patch ? patch.due_at : current?.due_at;
    if (effectiveStart && effectiveEnd) {
      const s = new Date(effectiveStart as string).getTime();
      const e = new Date(effectiveEnd as string).getTime();
      if (!Number.isNaN(s) && !Number.isNaN(e) && s > e) {
        // Whichever field the caller is changing gets clamped to the other.
        if ("start_at" in patch && !("due_at" in patch)) {
          patch.due_at = patch.start_at;
        } else {
          patch.due_at = patch.start_at ?? effectiveStart;
        }
      }
    }
  }

  const { data, error } = await ctx.supabase
    .from("tasks")
    .update(patch)
    .eq("id", params.id)
    .select("*")
    .single();

  if (error) return jsonError(500, "db_error", error.message);
  if (!data) return jsonError(404, "not_found", "Task not found.");
  return jsonOk({ data });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const ctx = await requireApiAuth(req, "write");
  if (!ctx.ok) return ctx.response;

  const { error } = await ctx.supabase
    .from("tasks")
    .delete()
    .eq("id", params.id)
    .eq("user_id", ctx.userId);

  if (error) return jsonError(500, "db_error", error.message);
  return jsonOk({ deleted: true });
}
