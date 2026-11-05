import { parseImport, type Norm } from "@/lib/task-import";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Bulk task import. Accepts a JSON body { format, content }.
 * format: "ticktick" | "todoist" | "ics" | "generic"
 * content: raw text of the export file.
 *
 * Each format is parsed into a normalized [{title, due_at, list, is_completed}]
 * shape, then projects are upserted by name and tasks bulk-inserted.
 *
 * Caps at 1000 rows per call to keep the request bounded.
 */
const MAX_ROWS = 1000;

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.content || !body?.format) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  const content = String(body.content);
  const format = String(body.format);

  const { data: prefs, error: prefsError } = await supabase.from('user_preferences').select('timezone').eq('user_id', u.user.id).maybeSingle();
  if (prefsError) return NextResponse.json({ error: 'account_timezone_unavailable' }, { status: 500 });
  let rows: Norm[];
  try {
    rows = parseImport(format, content, prefs?.timezone || 'UTC').slice(0, MAX_ROWS);
  } catch (e: any) {
    return NextResponse.json({ error: "parse_failed", detail: e?.message }, { status: 400 });
  }
  if (rows.length === 0) {
    return NextResponse.json({ imported: 0, skipped: 0, message: "no_rows" });
  }

  // Upsert projects by name
  const listNames = Array.from(new Set(rows.map((r) => r.list).filter(Boolean) as string[]));
  const projectIdByName = new Map<string, string>();
  if (listNames.length) {
    const { data: existing } = await supabase
      .from("projects")
      .select("id, name")
      .eq("user_id", u.user!.id)
      .in("name", listNames);
    for (const p of existing ?? []) projectIdByName.set(p.name, p.id);
    const missing = listNames.filter((n) => !projectIdByName.has(n));
    if (missing.length) {
      const { data: created } = await supabase
        .from("projects")
        .insert(missing.map((name) => ({ user_id: u.user!.id, name })))
        .select("id, name");
      for (const p of created ?? []) projectIdByName.set(p.name, p.id);
    }
  }

  // Insert tasks in batches of 200
  const tasks = rows.map((r) => ({
    user_id: u.user!.id,
    title: r.title,
    due_at: r.due_at, due_date: r.due_date, is_all_day: r.is_all_day, time_kind: r.time_kind, schedule_timezone: r.schedule_timezone,
    status: r.is_completed ? "done" : "open",
    is_completed: r.is_completed,
    completed_at: r.is_completed ? new Date().toISOString() : null,
    project_id: r.list ? projectIdByName.get(r.list) ?? null : null,
  }));

  let imported = 0;
  for (let i = 0; i < tasks.length; i += 200) {
    const slice = tasks.slice(i, i + 200);
    const { error } = await supabase.from("tasks").insert(slice);
    if (error) {
      console.error("[import]", error);
      return NextResponse.json({ error: "insert_failed", imported, detail: error.message }, { status: 500 });
    }
    imported += slice.length;
  }

  return NextResponse.json({ imported, skipped: 0 });
}
