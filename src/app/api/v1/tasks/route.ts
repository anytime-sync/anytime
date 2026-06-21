/**
 * GET  /api/v1/tasks
 *   List tasks. Filters: ?status=open|done|archived  ?from=YYYY-MM-DD
 *   ?to=YYYY-MM-DD  ?priority=low|med|high|0|1|3|5  ?project=<id>
 *   ?limit=1..200 (default 50)  ?cursor=<id> for pagination.
 *
 * POST /api/v1/tasks
 *   Create a task. Body: { title, due_at?, start_at?, priority?, notes?,
 *   project_id?, status?, is_all_day? }
 */

import { NextRequest } from "next/server";
import { requireApiAuth, jsonError, jsonOk } from "../_lib/auth";

// DB stores priority as integer: 0 (none) | 1 (low) | 3 (med) | 5 (high)
// API accepts both integer and string labels for ergonomics.
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
  const priorityParam = searchParams.get("priority");
  const projectId = searchParams.get("project");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const cursor = searchParams.get("cursor");

  let q = ctx.supabase
    .from("tasks")
    .select(
      "id,title,status,priority,due_at,start_at,is_all_day,notes,project_id,created_at,updated_at,completed_at",
    )
    .eq("user_id", ctx.userId)
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) q = q.eq("status", status);
  if (priorityParam) {
    const pInt = normalizePriority(priorityParam);
    if (pInt !== null) q = q.eq("priority", pInt);
  }
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
  is_all_day?: boolean | null;
  priority?: string | number | null;
  notes?: string | null;
  project_id?: string | null;
  status?: "open" | "done" | "archived";
  rrule?: string | null;
}

/**
 * Determine is_all_day from provided dates when not explicitly set.
 * If start_at or due_at contains a time component (non-midnight),
 * the task is NOT all-day.
 */
function deriveIsAllDay(body: CreateTaskBody): boolean {
  // Explicit override takes precedence
  if (body.is_all_day !== undefined && body.is_all_day !== null) {
    return body.is_all_day;
  }
  // Check the raw ISO string for midnight in the sender's timezone.
  // "2026-06-01T00:00:00+08:00" is midnight Taipei = all-day,
  // even though UTC representation is 2026-05-31T16:00:00Z.
  // A date-only string ("2026-06-01") or T00:00:00 in any offset = all-day.
  const midnightRe = /T00:00:00([Z+-]|$)/;
  const dateOnlyRe = /^\d{4}-\d{2}-\d{2}$/;
  function isMidnightOrDateOnly(iso: string): boolean {
    return dateOnlyRe.test(iso) || midnightRe.test(iso);
  }
  if (body.start_at && !isMidnightOrDateOnly(body.start_at)) return false;
  if (body.due_at && !isMidnightOrDateOnly(body.due_at)) return false;
  // Default: all-day
  return true;
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
      "\`title\` is required (string, <= 500 chars).",
    );
  }

  let sanitizedStartAt = body.start_at ?? null;
  let sanitizedDueAt = body.due_at ?? null;
  const MIN_DURATION_MS = 30 * 60 * 1000;
  const isMidnight = (iso: string) => /T00:00:00/.test(iso);

  // Validate caller-supplied dates up front — an unparseable string
  // becomes NaN and throws RangeError on .toISOString() below.
  const isValidIso = (v: unknown) => typeof v === "string" && !Number.isNaN(new Date(v).getTime());
  if (sanitizedStartAt != null && !isValidIso(sanitizedStartAt)) {
    return jsonError(400, "invalid_start_at", "`start_at` must be a valid ISO-8601 date.");
  }
  if (sanitizedDueAt != null && !isValidIso(sanitizedDueAt)) {
    return jsonError(400, "invalid_due_at", "`due_at` must be a valid ISO-8601 date.");
  }

  // Rule 1: timed due_at with no start_at — set start_at = due_at - 30min.
  // A task with only due_at has no timeline slot and won’t show correctly.
  if (sanitizedDueAt && !sanitizedStartAt && !isMidnight(sanitizedDueAt)) {
    sanitizedStartAt = new Date(new Date(sanitizedDueAt).getTime() - MIN_DURATION_MS).toISOString();
  }

  // Rule 2: timed start_at with no due_at — set due_at = start_at + 30min.
  if (sanitizedStartAt && !sanitizedDueAt && !isMidnight(sanitizedStartAt)) {
    sanitizedDueAt = new Date(new Date(sanitizedStartAt).getTime() + MIN_DURATION_MS).toISOString();
  }

  // Rule 3: start > end — set due_at = start_at + 30min (never zero-duration).
  if (sanitizedStartAt && sanitizedDueAt) {
    const s = new Date(sanitizedStartAt).getTime();
    const e = new Date(sanitizedDueAt).getTime();
    if (!Number.isNaN(s) && !Number.isNaN(e) && s >= e) {
      sanitizedDueAt = new Date(s + MIN_DURATION_MS).toISOString();
    }
  }

  const { data, error } = await ctx.supabase
    .from("tasks")
    .insert({
      user_id: ctx.userId,
      title: body.title,
      due_at: sanitizedDueAt,
      start_at: sanitizedStartAt,
      is_all_day: deriveIsAllDay(body),
      priority: normalizePriority(body.priority) ?? 0,
      notes: body.notes ?? null,
      project_id: body.project_id ?? null,
      status: body.status ?? "open",
      rrule: body.rrule ?? null,
    })
    .select("*")
    .single();

  if (error) return jsonError(500, "db_error", error.message);
  return jsonOk({ data }, { status: 201 });
}
