"use client";
import { createBrowserClient, type CookieOptions } from "@supabase/ssr";

/**
 * Browser-side Supabase client.
 *
 * IMPORTANT: by default the browser client writes its auth cookies via
 * `document.cookie` without `Max-Age`, which makes them **session-only**.
 * That's why "Stay signed in" worked on /login (we restamp on the
 * server) but not for fresh signups — the freshly-issued tokens never
 * round-trip through middleware before the user closes the tab.
 *
 * We override `setAll` here so every Supabase auth cookie picks up a
 * 30-day Max-Age right at the moment the browser sets it. Users who
 * unchecked "Stay signed in" set `fl.auth.persist=0` first; we honour
 * that and keep cookies session-only for them.
 */

const REMEMBER_ME_DAYS = 30;
const REMEMBER_ME_SECONDS = REMEMBER_ME_DAYS * 24 * 60 * 60;

type CookieToSet = { name: string; value: string; options?: CookieOptions };

function readPersistOptOut(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split("; ")
    .some((c) => c === "fl.auth.persist=0" || c.startsWith("fl.auth.persist=0;"));
}

function getAllCookies() {
  if (typeof document === "undefined") return [];
  return document.cookie
    .split("; ")
    .filter(Boolean)
    .map((pair) => {
      const eq = pair.indexOf("=");
      const name = eq === -1 ? pair : pair.slice(0, eq);
      const value = eq === -1 ? "" : decodeURIComponent(pair.slice(eq + 1));
      return { name, value };
    });
}

function setOneCookie(name: string, value: string, options?: CookieOptions) {
  if (typeof document === "undefined") return;
  const isAuthCookie = name.startsWith("sb-") || name.includes("auth-token");
  const persistOptOut = readPersistOptOut();

  const parts: string[] = [`${name}=${encodeURIComponent(value ?? "")}`];
  parts.push(`path=${options?.path ?? "/"}`);

  // Determine Max-Age:
  // - If caller passed maxAge, respect it (Supabase passes 0 for clears).
  // - Else if it's an auth cookie and the user wants persistence, force 30d.
  // - Else leave as session cookie.
  let maxAge: number | undefined;
  if (options && typeof options.maxAge === "number") {
    maxAge = options.maxAge;
  } else if (isAuthCookie && !persistOptOut) {
    maxAge = REMEMBER_ME_SECONDS;
  }
  if (typeof maxAge === "number") {
    parts.push(`Max-Age=${maxAge}`);
  }

  if (options?.expires) {
    const exp = options.expires instanceof Date ? options.expires : new Date(options.expires);
    parts.push(`Expires=${exp.toUTCString()}`);
  }
  if (options?.domain) parts.push(`Domain=${options.domain}`);
  parts.push(`SameSite=${options?.sameSite ?? "Lax"}`);
  if (options?.secure ?? location.protocol === "https:") parts.push("Secure");

  document.cookie = parts.join("; ");
}

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return getAllCookies();
        },
        setAll(toSet: CookieToSet[]) {
          for (const { name, value, options } of toSet) {
            setOneCookie(name, value, options);
          }
        },
      },
    }
  );
}
