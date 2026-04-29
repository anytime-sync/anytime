import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";

/**
 * Helpers for admin API routes. Each route calls `requireAdmin()` first,
 * which (a) verifies the calling user is the hardcoded admin email and
 * (b) returns a service-role Supabase client so the route can call the
 * privileged auth.admin.* APIs (invite, ban, delete users, etc.).
 *
 * Anything that hits auth.users directly belongs here — the SQL
 * SECURITY DEFINER helpers in migrations can only update public tables.
 */
export type AdminContext = {
  /** Service-role client. Bypasses RLS — use with care. */
  admin: SupabaseClient;
  /** The calling admin's email, normalized lowercase. */
  email: string;
};

export async function requireAdmin(): Promise<
  | { ok: true; ctx: AdminContext }
  | { ok: false; status: number; error: string }
> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, error: "unauthorized" };
  if (!isAdminEmail(user.email)) {
    return { ok: false, status: 403, error: "forbidden" };
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !supaUrl) {
    return { ok: false, status: 500, error: "supabase_misconfigured" };
  }

  const admin = createSupabaseClient(supaUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return {
    ok: true,
    ctx: { admin: admin, email: user.email!.toLowerCase().trim() },
  };
}
