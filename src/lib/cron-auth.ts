import { timingSafeEqual } from "crypto";

/**
 * Vercel Cron / scheduled-task auth.
 *
 * Fail-closed if CRON_SECRET is unset. Uses a constant-time compare to
 * avoid leaking the secret over response timing (Vercel's edge fronting
 * makes this a paranoid hardening, but cheap to do correctly).
 *
 * Usage:
 *   if (!isAuthorizedCron(req.headers.get("authorization"))) {
 *     return NextResponse.json({ error: "unauthorized" }, { status: 401 });
 *   }
 */
export function isAuthorizedCron(authHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (!authHeader) return false;
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(authHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
