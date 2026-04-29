import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * Server-side Supabase client (Server Components, Route Handlers,
 * Server Actions).
 *
 * We restamp Supabase auth cookies with a 30-day Max-Age so that
 * server-issued cookies (e.g. /auth/callback exchanging an email-link
 * code, or any server action that triggers a token refresh) persist
 * across browser sessions. Users who opted out of "Stay signed in"
 * have `fl.auth.persist=0` and we honour that.
 */
const REMEMBER_ME_DAYS = 30;
const REMEMBER_ME_SECONDS = REMEMBER_ME_DAYS * 24 * 60 * 60;

export function createClient() {
  const cookieStore = cookies();
  const persistOptOut = cookieStore.get("fl.auth.persist")?.value === "0";

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(toSet: CookieToSet[]) {
          try {
            toSet.forEach(({ name, value, options }) => {
              const isAuthCookie =
                name.startsWith("sb-") || name.includes("auth-token");
              const merged: CookieOptions = { ...options };
              // Don't override an explicit maxAge from Supabase (e.g. 0
              // when clearing). Otherwise stamp 30 days for auth cookies.
              if (
                isAuthCookie &&
                !persistOptOut &&
                (merged.maxAge === undefined || merged.maxAge === null)
              ) {
                merged.maxAge = REMEMBER_ME_SECONDS;
              }
              cookieStore.set(name, value, merged);
            });
          } catch {
            // Server Components can't set cookies — ignored when middleware refreshes the session.
          }
        },
      },
    }
  );
}
