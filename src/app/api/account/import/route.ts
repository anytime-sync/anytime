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
type Norm = {
  title: string;
  due_at: string | null;
  list: string | null;
  is_completed: boolean;
};

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

  let rows: Norm[];
  try {
    rows = parseImport(format, content).slice(0, MAX_ROWS);
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
    due_at: r.due_at,
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

/* ---------- Format-specific parsers ---------- */

function parseImport(format: string, content: string): Norm[] {
  switch (format) {
    case "ticktick": return parseTickTick(content);
    case "todoist":  return parseTodoist(content);
    case "ics":      return parseIcs(content);
    case "generic":  return parseGenericCsv(content);
    default: throw new Error("unknown_format");
  }
}

/** TickTick CSV columns include: Folder Name, Title, Tags, Content,
 *  Is Check list, Start Date, Due Date, Reminder, Repeat, Priority, Status. */
function parseTickTick(text: string): Norm[] {
  const rows = csvRows(text);
  if (!rows.length) return [];
  const header = rows[0]!.map((c) => c.toLowerCase().trim());
  const titleIdx = header.indexOf("title");
  const folderIdx = header.indexOf("folder name");
  const dueIdx = header.indexOf("due date");
  const statusIdx = header.indexOf("status");
  if (titleIdx < 0) return [];
  return rows.slice(1)
    .filter((r) => r[titleIdx])
    .map((r) => ({
      title: String(r[titleIdx]).trim(),
      list: folderIdx >= 0 ? (String(r[folderIdx] ?? "").trim() || null) : null,
      due_at: dueIdx >= 0 ? parseDate(r[dueIdx]) : null,
      // TickTick: Status 0=normal, 1=completed, 2=archived
      is_completed: statusIdx >= 0 && String(r[statusIdx]).trim() === "1",
    }));
}

/** Todoist CSV: TYPE, CONTENT, DESCRIPTION, PRIORITY, INDENT, AUTHOR, RESPONSIBLE, DATE, DATE_LANG, TIMEZONE, ... */
function parseTodoist(text: string): Norm[] {
  const rows = csvRows(text);
  if (!rows.length) return [];
  const header = rows[0]!.map((c) => c.toLowerCase().trim());
  const typeIdx = header.indexOf("type");
  const contentIdx = header.indexOf("content");
  const dateIdx = header.indexOf("date");
  if (contentIdx < 0) return [];
  // Todoist exports include section/note rows too — only keep type=task.
  return rows.slice(1)
    .filter((r) => r[contentIdx] && (typeIdx < 0 || String(r[typeIdx]).toLowerCase() === "task"))
    .map((r) => ({
      title: String(r[contentIdx]).trim(),
      list: null, // Todoist single-CSV exports don't include project per row
      due_at: dateIdx >= 0 ? parseDate(r[dateIdx]) : null,
      is_completed: false,
    }));
}

/** Apple Reminders / Calendar .ics export — VTODO blocks. */
function parseIcs(text: string): Norm[] {
  const out: Norm[] = [];
  const blocks = text.split(/BEGIN:VTODO/i).slice(1);
  for (const block of blocks) {
    const end = block.search(/END:VTODO/i);
    const body = end >= 0 ? block.slice(0, end) : block;
    const lines = body.split(/\r?\n/);
    let title = "";
    let due: string | null = null;
    let completed = false;
    for (const ln of lines) {
      const m = ln.match(/^([A-Z\-]+)(?:;[^:]*)?:(.*)$/);
      if (!m) continue;
      const k = m[1]!.toUpperCase();
      const v = m[2]!.trim();
      if (k === "SUMMARY") title = v;
      else if (k === "DUE" || k === "DTSTART") due = parseIcsDate(v);
      else if (k === "STATUS") completed = v.toUpperCase() === "COMPLETED";
    }
    if (title) out.push({ title, list: null, due_at: due, is_completed: completed });
  }
  return out;
}

/** Generic CSV with columns: title, due, list, completed. */
function parseGenericCsv(text: string): Norm[] {
  const rows = csvRows(text);
  if (!rows.length) return [];
  const header = rows[0]!.map((c) => c.toLowerCase().trim());
  const titleIdx = header.indexOf("title");
  const dueIdx = header.indexOf("due");
  const listIdx = header.indexOf("list");
  const completedIdx = header.indexOf("completed");
  if (titleIdx < 0) return [];
  return rows.slice(1)
    .filter((r) => r[titleIdx])
    .map((r) => ({
      title: String(r[titleIdx]).trim(),
      list: listIdx >= 0 ? (String(r[listIdx] ?? "").trim() || null) : null,
      due_at: dueIdx >= 0 ? parseDate(r[dueIdx]) : null,
      is_completed: completedIdx >= 0 && /^(true|1|yes|y)$/i.test(String(r[completedIdx]).trim()),
    }));
}

/* ---------- helpers ---------- */

/** Minimal CSV parser handling quoted commas and double-quote escapes. */
function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let i = 0;
  let cell = "";
  let row: string[] = [];
  let inQuote = false;
  while (i < text.length) {
    const ch = text[i]!;
    if (inQuote) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 2; continue; }
      if (ch === '"') { inQuote = false; i++; continue; }
      cell += ch; i++; continue;
    }
    if (ch === '"') { inQuote = true; i++; continue; }
    if (ch === ",") { row.push(cell); cell = ""; i++; continue; }
    if (ch === "\r") { i++; continue; }
    if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; i++; continue; }
    cell += ch; i++;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.length && r.some((c) => c.length));
}

function parseDate(s: any): string | null {
  if (!s) return null;
  const str = String(s).trim();
  if (!str) return null;
  const d = new Date(str);
  if (isNaN(+d)) return null;
  return d.toISOString();
}

function parseIcsDate(v: string): string | null {
  // Common forms: 20260430T093000Z, 20260430, 20260430T093000
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z?))?$/);
  if (!m) return null;
  const [, y, mo, d, hh, mm, ss, z] = m;
  const iso = hh
    ? `${y}-${mo}-${d}T${hh}:${mm}:${ss ?? "00"}${z ? "Z" : ""}`
    : `${y}-${mo}-${d}T00:00:00`;
  const dt = new Date(iso);
  return isNaN(+dt) ? null : dt.toISOString();
}
