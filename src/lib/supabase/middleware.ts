import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * "Stay signed in" cookie life. Without an explicit maxAge, Supabase's
 * auth cookies become session cookies — they're cleared when the
 * browser closes, which is why users were getting re-prompted on every
 * revisit. We force a 30-day life on auth cookies here.
 *
 * The login form sets `fl.auth.persist=0` if the user unchecks "Stay
 * signed in" — in that case we leave cookies as session-only and let
 * the browser drop them on tab close.
 */
const REMEMBER_ME_DAYS = 30;
const REMEMBER_ME_SECONDS = REMEMBER_ME_DAYS * 24 * 60 * 60;

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const persistOptOut = request.cookies.get("fl.auth.persist")?.value === "0";

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(toSet: CookieToSet[]) {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => {
            // Stamp every Supabase-set auth cookie with our 30-day maxAge
            // unless the user opted out of "stay signed in".
            const isAuthCookie = name.startsWith("sb-") || name.includes("auth-token");
            const merged: CookieOptions = { ...options };
            if (isAuthCookie && !persistOptOut) {
              merged.maxAge = REMEMBER_ME_SECONDS;
            }
            supabaseResponse.cookies.set(name, value, merged);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthRoute =
    path.startsWith("/login") ||
    path.startsWith("/signup") ||
    path.startsWith("/auth");

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  if (user && (path === "/login" || path === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
