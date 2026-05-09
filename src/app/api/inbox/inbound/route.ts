import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { parseQuickInput, type ParsedQuickInput } from "@/lib/quick-parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Inbound email webhook — turns forwarded emails into Inbox tasks.
 *
 * Round D wires a per-user alias (`<alias_local>@firstlight.to`) and
 * any email sent there becomes a task in the matching user's Inbox.
 *
 * The shape we accept is Postmark's inbound JSON, but it cleanly maps
 * from Cloudflare Email Workers, Resend Inbound, and SendGrid with a
 * thin shim — see `scripts/email-to-task-setup.md`.
 *
 * Auth: `Authorization: Bearer ${INBOUND_EMAIL_SECRET}`. The provider
 * sets this header; we reject anything else. The secret is also
 * required to be set — an unset env var fails closed.
 *
 * Failure modes:
 *   - bad auth                        → 401
 *   - secret unset                    → 401 (fail closed)
 *   - alias couldn't be parsed        → 400
 *   - alias not found                 → 404 (don't reveal existence)
 *   - duplicate (MessageID seen)      → 200 idempotent
 *   - DB / unexpected error           → 500, error logged to
 *                                       email_inbox_log if we have a
 *                                       user_id, otherwise just to
 *                                       console.
 *
 * v2 ideas: attachments (Postmark sends them as base64 Attachments),
 * sender allowlists, smart parsing of forwarded bodies (strip
 * "From: …" cruft when From is the user's own address).
 */

type InboundPayload = {
  From?: string;
  To?: string;
  ToFull?: { Email: string }[];
  Subject?: string;
  TextBody?: string;
  HtmlBody?: string;
  MessageID?: string;
  Date?: string;
  // Postmark also sends `Attachments`; we ignore them for v1.
  // TODO(v2): persist attachments to Supabase Storage and link to the task.
  Attachments?: unknown;
};

type AliasRow = {
  user_id: string;
  alias_local: string;
  default_list_id: string | null;
};

const FIRSTLIGHT_DOMAIN_RE = /@firstlight\.to$/i;
const HTML_TAG_RE = /<[^>]+>/g;
const NOTES_MAX = 4000;

/**
 * Pull the bare email address out of a value that might be
 * `"Display Name <addr@domain>"`, `"<addr@domain>"`, or just
 * `"addr@domain"`. Returns `null` if no `@` is found.
 */
function extractAddress(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const angle = raw.match(/<([^>]+)>/);
  const candidate = (angle ? angle[1] : raw).trim().toLowerCase();
  if (!candidate.includes("@")) return null;
  return candidate;
}

/**
 * Given a recipient email address, extract the alias local-part —
 * stripping any `+` extension (so `inbox-abc+notes@firstlight.to`
 * resolves to `inbox-abc`). Returns null if the address isn't on
 * `firstlight.to`.
 */
function aliasFromAddress(addr: string | null): string | null {
  if (!addr) return null;
  if (!FIRSTLIGHT_DOMAIN_RE.test(addr)) return null;
  const local = addr.split("@")[0];
  if (!local) return null;
  // `inbox-abc+foo` → `inbox-abc`
  const plus = local.indexOf("+");
  return (plus >= 0 ? local.slice(0, plus) : local).trim();
}

/**
 * Best-effort HTML → text. Strips tags, decodes a handful of common
 * named entities, and collapses whitespace. We don't bring in a real
 * parser — the result is dropped into `notes` as plain text and the
 * user can edit it.
 */
function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(HTML_TAG_RE, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}


/**
 * Strip common reply / forward prefixes so the natural-language
 * parser sees the actual subject. Handles English ("Re:", "Fwd:",
 * "FW:") and a few common locale variants ("AW:", "WG:", "回覆:",
 * "轉寄:"). Repeats — "Re: Re: Fwd: foo" collapses to "foo".
 */
function stripReplyPrefixes(subject: string): string {
  let out = subject.trim();
  // Iteratively peel one prefix at a time so chains collapse fully.
  for (let i = 0; i < 6; i++) {
    const next = out.replace(
      /^(re|fw|fwd|aw|wg|回覆|回复|轉寄|转寄|轉發|转发)\s*[:：]\s*/i,
      ""
    );
    if (next === out) break;
    out = next;
  }
  return out;
}

/**
 * Resolve `tagNames` (and optionally `projectName`) from a parsed
 * subject into actual `tags.id` / `projects.id` for the user, creating
 * tag rows on the fly when needed. Mirrors what the in-app quick-add
 * flow does so emailing produces the same result as typing.
 */
async function resolveTagsAndProject(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  parsed: ParsedQuickInput
): Promise<{ tagIds: string[]; projectId: string | null }> {
  let projectId: string | null = null;
  if (parsed.projectName) {
    const { data: proj } = await supabase
      .from("projects")
      .select("id")
      .eq("user_id", userId)
      .ilike("name", parsed.projectName)
      .maybeSingle();
    if (proj?.id) projectId = proj.id as string;
  }

  const tagIds: string[] = [];
  for (const name of parsed.tagNames) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    // Try existing first.
    const { data: existing } = await supabase
      .from("tags")
      .select("id")
      .eq("user_id", userId)
      .ilike("name", trimmed)
      .maybeSingle();
    if (existing?.id) {
      tagIds.push(existing.id as string);
      continue;
    }
    // Otherwise create.
    const { data: created } = await supabase
      .from("tags")
      .insert({ user_id: userId, name: trimmed })
      .select("id")
      .single();
    if (created?.id) tagIds.push(created.id as string);
  }
  return { tagIds, projectId };
}

function buildNotes(
  text: string | undefined,
  html: string | undefined,
  from: string | undefined,
  date: string | undefined
): string {
  let body = "";
  if (text && text.trim().length > 0) {
    body = text.trim();
  } else if (html && html.trim().length > 0) {
    body = htmlToText(html);
  }
  if (body.length > NOTES_MAX) {
    body = body.slice(0, NOTES_MAX).trimEnd() + "…";
  }
  const fromLabel = from?.trim() || "unknown sender";
  const dateLabel = date?.trim() || new Date().toUTCString();
  const footer = `\n\n— from ${fromLabel} on ${dateLabel}`;
  return body ? body + footer : footer.trim();
}

export async function POST(req: Request) {
  const expectedSecret = process.env.INBOUND_EMAIL_SECRET;
  if (!expectedSecret) {
    // Fail closed — refuse to accept inbound mail unless the operator
    // has explicitly configured a shared secret with the provider.
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401 }
    );
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${expectedSecret}`) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401 }
    );
  }

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supaUrl || !serviceKey) {
    return NextResponse.json(
      { error: "supabase_misconfigured" },
      { status: 500 }
    );
  }
  const supabase = createSupabaseClient(supaUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let payload: InboundPayload;
  try {
    payload = (await req.json()) as InboundPayload;
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  // Resolve recipient → alias_local. Prefer ToFull[] (Postmark) since
  // it gives us each recipient cleanly; fall back to To if absent.
  let aliasLocal: string | null = null;
  if (Array.isArray(payload.ToFull)) {
    for (const entry of payload.ToFull) {
      const a = aliasFromAddress(extractAddress(entry?.Email));
      if (a) {
        aliasLocal = a;
        break;
      }
    }
  }
  if (!aliasLocal && typeof payload.To === "string") {
    // To header may be a comma-separated list with display names.
    for (const part of payload.To.split(",")) {
      const a = aliasFromAddress(extractAddress(part));
      if (a) {
        aliasLocal = a;
        break;
      }
    }
  }
  if (!aliasLocal) {
    return NextResponse.json(
      { error: "no_recipient" },
      { status: 400 }
    );
  }

  // Look up the alias. RLS doesn't apply to service-role.
  const { data: aliasRow, error: aliasErr } = await supabase
    .from("user_inbox_aliases")
    .select("user_id, alias_local, default_list_id")
    .eq("alias_local", aliasLocal)
    .maybeSingle();

  if (aliasErr) {
    console.error("[inbox/inbound] alias lookup failed:", aliasErr.message);
    return NextResponse.json(
      { error: "lookup_failed" },
      { status: 500 }
    );
  }
  if (!aliasRow) {
    // Don't echo the alias back — pure 404 with a generic message so
    // we don't become an alias-existence oracle.
    console.warn(
      `[inbox/inbound] no alias match for local-part (length=${aliasLocal.length})`
    );
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const alias = aliasRow as AliasRow;
  const messageId = (payload.MessageID ?? "").trim() || null;

  // Dedup. (user_id, message_id) is UNIQUE WHERE message_id IS NOT
  // NULL — we look up first so we can return the existing task_id.
  if (messageId) {
    const { data: existing } = await supabase
      .from("email_inbox_log")
      .select("id, task_id")
      .eq("user_id", alias.user_id)
      .eq("message_id", messageId)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({
        ok: true,
        task_id: existing.task_id ?? null,
        deduped: true,
      });
    }
  }

  const rawSubject = (payload.Subject ?? "").trim();
  const fromAddr = extractAddress(payload.From) ?? null;

  // Pull the user's existing tags + projects so the parser can match
  // plain mentions ("biz review meeting" → existing tag "biz review")
  // the same way the in-app Quick Add does.
  const [{ data: existingTagRows }, { data: existingProjectRows }] = await Promise.all([
    supabase.from("tags").select("name").eq("user_id", alias.user_id),
    supabase.from("projects").select("name").eq("user_id", alias.user_id),
  ]);
  const existingTags = (existingTagRows ?? []).map((r) => r.name as string).filter(Boolean);
  const existingProjects = (existingProjectRows ?? []).map((r) => r.name as string).filter(Boolean);

  // Strip reply/forward prefixes BEFORE parsing so chrono and the
  // priority/tag heuristics see the real subject.
  const cleanedSubject = stripReplyPrefixes(rawSubject);

  // Run the same NL parser used by /app's Quick Add input. Empty
  // subject → empty parsed.title; we fall back to "(no subject)".
  const parsed: ParsedQuickInput = cleanedSubject.length > 0
    ? parseQuickInput(cleanedSubject, { existingTags, existingProjects })
    : {
        title: "",
        start_at: null,
        due_at: null,
        is_all_day: false,
        priority: 0,
        tagNames: [],
        rrule: null,
        reminder_at: null,
      };

  const title = (parsed.title || cleanedSubject || rawSubject || "(no subject)").slice(0, 500);

  let notes = buildNotes(
    payload.TextBody,
    payload.HtmlBody,
    payload.From,
    payload.Date
  );
  // If parsing reshaped the title (extracted a date / tag / priority),
  // keep the original subject in the notes so the user can see what
  // the parser collapsed. Otherwise the original IS the title and the
  // line would be redundant.
  if (rawSubject && rawSubject !== title) {
    notes = notes + `\n— original subject: ${rawSubject}`;
  }

  // Resolve tag IDs + a project_id from the parsed names, creating
  // missing tag rows on the fly.
  const { tagIds, projectId: parsedProjectId } = await resolveTagsAndProject(
    supabase,
    alias.user_id,
    parsed
  );
  const projectId = parsedProjectId ?? alias.default_list_id ?? null;

  // Insert the task. The parsed values become the task's date / time /
  // priority / repeat / reminder.
  const { data: insertedTask, error: taskErr } = await supabase
    .from("tasks")
    .insert({
      user_id: alias.user_id,
      project_id: projectId,
      title,
      notes,
      is_completed: false,
      priority: parsed.priority,
      start_at: parsed.start_at,
      due_at: parsed.due_at,
      is_all_day: parsed.is_all_day,
      rrule: parsed.rrule,
      reminder_at: parsed.reminder_at,
    })
    .select("id")
    .single();

  if (taskErr || !insertedTask) {
    const errMsg = taskErr?.message ?? "task_insert_failed";
    console.error("[inbox/inbound] task insert failed:", errMsg);
    // Best-effort: log the error so the user can see it in support.
    await supabase.from("email_inbox_log").insert({
      user_id: alias.user_id,
      message_id: messageId,
      from_address: fromAddr,
      subject: rawSubject || null,
      task_id: null,
      status: "error",
      error_message: errMsg.slice(0, 500),
    });
    return NextResponse.json({ error: "task_insert_failed" }, { status: 500 });
  }

  // Log success. Even if this fails, we've already created the task,
  // so we just warn.
  const { error: logErr } = await supabase.from("email_inbox_log").insert({
    user_id: alias.user_id,
    message_id: messageId,
    from_address: fromAddr,
    subject: rawSubject || null,
    task_id: insertedTask.id,
    status: "created",
  });
  if (logErr) {
    console.warn("[inbox/inbound] log insert failed:", logErr.message);
  }


  // Attach parsed tags to the new task. Best-effort — failure here
  // shouldn't fail the request since the task already exists.
  if (tagIds.length > 0) {
    const rows = tagIds.map((tag_id) => ({ task_id: insertedTask.id, tag_id }));
    const { error: tagErr } = await supabase.from("task_tags").insert(rows);
    if (tagErr) {
      console.warn("[inbox/inbound] tag attach failed:", tagErr.message);
    }
  }

  // Bump alias counters. RPC would be nicer but a read-then-write keeps
  // the migration-free contract — and races aren't fatal here, the
  // total_received counter is "approximate UI hint" not "billing".
  const { data: cur } = await supabase
    .from("user_inbox_aliases")
    .select("total_received")
    .eq("user_id", alias.user_id)
    .maybeSingle();
  const nextTotal = (cur?.total_received ?? 0) + 1;
  await supabase
    .from("user_inbox_aliases")
    .update({
      last_received_at: new Date().toISOString(),
      total_received: nextTotal,
    })
    .eq("user_id", alias.user_id);

  return NextResponse.json({ ok: true, task_id: insertedTask.id });
}
