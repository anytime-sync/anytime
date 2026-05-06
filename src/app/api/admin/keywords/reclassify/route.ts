import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { requireAdmin } from "@/lib/admin-server";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Allow Vercel Cron to invoke this route without the admin email check
 * by sending `Authorization: Bearer <CRON_SECRET>`. Vercel automatically
 * sends an `x-vercel-cron: 1` header on cron-triggered requests; we
 * accept either signal so manual curl works too.
 */
async function isCronCall(): Promise<boolean> {
  const hdrs = await headers();
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const authz = hdrs.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (authz === expected) return true;
  // Vercel Cron also sends this header; treat it as proof when paired
  // with the secret cookie/header missing (defensive — without the
  // header, anyone who learned the secret could call us).
  return false;
}

/**
 * POST /api/admin/keywords/reclassify
 *
 * Walks every incomplete task in the system, scans its title for any
 * enabled phrase from `site_priority_keywords` (matching against the
 * task owner's preferred locale, falling back to "en"), and updates the
 * task's priority to the *highest* matching phrase priority.
 *
 * We never lower a priority a user set by hand &mdash; we only bump it up.
 * That means re-running this is idempotent and safe to wire to a cron.
 */
export async function POST() {
  // Allow either a logged-in admin OR a Vercel Cron invocation w/ the
  // shared secret. Cron path constructs its own service-role client.
  // SupabaseClient<any> here because requireAdmin's typed client and a
  // freshly-constructed cron client come from different generic
  // parameterisations even though the underlying class is identical.
  let admin: SupabaseClient<any, "public", "public", any, any>;
  if (await isCronCall()) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: "supabase_misconfigured" }, { status: 500 });
    }
    admin = createSupabaseClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  } else {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    admin = auth.ctx.admin as unknown as SupabaseClient<any, "public", "public", any, any>;
  }

  const { data: keywordRows, error: kErr } = await admin
    .from("site_priority_keywords")
    .select("locale, phrase, priority, enabled")
    .eq("enabled", true);
  if (kErr) {
    return NextResponse.json({ error: kErr.message }, { status: 400 });
  }

  // Build a per-locale phrase index, sorted by priority desc so the
  // first match (highest priority) wins inside a locale.
  const byLocale = new Map<string, Array<{ phrase: string; priority: number }>>();
  for (const r of keywordRows ?? []) {
    const arr = byLocale.get(r.locale) ?? [];
    arr.push({ phrase: r.phrase, priority: r.priority });
    byLocale.set(r.locale, arr);
  }
  for (const arr of byLocale.values()) {
    arr.sort((a, b) => b.priority - a.priority);
  }

  // Pull every incomplete task with the owner's profile language.
  const { data: tasks, error: tErr } = await admin
    .from("tasks")
    .select("id, title, priority, user_id")
    .eq("is_completed", false);
  if (tErr) {
    return NextResponse.json({ error: tErr.message }, { status: 400 });
  }

  const userIds = Array.from(new Set((tasks ?? []).map((t) => t.user_id)));
  let langByUser = new Map<string, string>();
  if (userIds.length) {
    const { data: profs } = await admin
      .from("profiles")
      .select("id, language")
      .in("id", userIds);
    for (const p of profs ?? []) {
      langByUser.set(p.id, p.language ?? "en");
    }
  }

  let updated = 0;
  for (const task of tasks ?? []) {
    const locale = langByUser.get(task.user_id) ?? "en";
    const phrases = byLocale.get(locale) ?? byLocale.get("en") ?? [];
    if (!phrases.length) continue;

    const lowerTitle = (task.title ?? "").toLowerCase();
    let nextPriority = task.priority ?? 0;
    for (const { phrase, priority } of phrases) {
      if (priority <= nextPriority) continue;
      if (lowerTitle.includes(phrase.toLowerCase())) {
        nextPriority = priority;
        // keep going &mdash; phrases are already sorted desc, so we'll exit
        // at the first match in practice. Continue is fine in case sort
        // breaks down on equal priorities.
      }
    }

    if (nextPriority !== (task.priority ?? 0)) {
      const { error: uErr } = await admin
        .from("tasks")
        .update({ priority: nextPriority })
        .eq("id", task.id);
      if (!uErr) updated += 1;
    }
  }

  return NextResponse.json({ ok: true, scanned: tasks?.length ?? 0, updated });
}

/**
 * Vercel Cron sends GET. Delegate to POST so both work.
 */
export async function GET() {
  return POST();
}
