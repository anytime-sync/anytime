import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/impersonate/stop
 *
 * Reverses /start: copies the snapshot under fl.adm.<name> back into
 * the regular sb-*-auth-token slots, then deletes the snapshot + the
 * marker cookies. After this returns, the next request from this
 * browser is authenticated as the original admin user again.
 *
 * Idempotent: if there's no snapshot, returns ok with no_session_to_restore.
 */
export async function POST(req: Request) {
  // CSRF protection: only allow same-origin POSTs. Without this, any
  // cross-origin page that lures an admin into a fetch can force-end
  // their impersonation session (or worse, trigger cookie restoration
  // race conditions). Same-origin is sufficient because Supabase auth
  // cookies are httpOnly + SameSite=Lax.
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) {
        return NextResponse.json({ error: "bad_origin" }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "bad_origin" }, { status: 403 });
    }
  }
  const cookieStore = await cookies();
  const baseCookieOpts = {
    maxAge: 30 * 24 * 60 * 60,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: true,
    path: "/",
  };

  const snapshots: Array<{ name: string; value: string }> = [];
  for (const c of cookieStore.getAll()) {
    if (c.name.startsWith("fl.adm.")) {
      snapshots.push({
        name: c.name.slice("fl.adm.".length),
        value: c.value,
      });
    }
  }
  if (snapshots.length === 0) {
    return NextResponse.json({ ok: true, restored: 0 });
  }

  // Restore the admin's auth cookies.
  for (const s of snapshots) {
    cookieStore.set(s.name, s.value, baseCookieOpts);
  }

  // Wipe the snapshot + markers.
  for (const s of snapshots) {
    cookieStore.delete(`fl.adm.${s.name}`);
  }
  cookieStore.delete("fl.imp.target_email");
  cookieStore.delete("fl.imp.target_id");

  return NextResponse.json({ ok: true, restored: snapshots.length });
}
