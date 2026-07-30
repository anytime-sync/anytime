import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Passwordless magic-link capture for the blog Daily Edition CTA.
 *
 * Step 2 of the blog -> signup growth loop (step 1 = the <DailyEditionCta>
 * band at the foot of every post). A reader drops their email inline; we send
 * a Supabase OTP magic link that, on click, creates the account and lands them
 * straight in /app with a pre-seeded first Daily Edition (see
 * src/app/api/ai/daily-edition/route.ts). No password step.
 *
 * Attribution: ref + signup_source are written into the new user's
 * raw_user_meta_data so blog-sourced signups stay measurable once the GA4/GSC
 * analytics loop is restored (task f7016e92). track.ts is a no-op today
 * (Plausible removed), so user metadata is the durable attribution signal.
 */

// Best-effort in-memory throttle. Serverless instances are ephemeral, so this
// only catches bursts that hit a warm instance; Supabase's own OTP rate limit
// is the real backstop. Kept intentionally simple.
const HITS = new Map<string, { n: number; ts: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const rec = HITS.get(ip);
  if (!rec || now - rec.ts > WINDOW_MS) {
    HITS.set(ip, { n: 1, ts: now });
    return false;
  }
  rec.n += 1;
  return rec.n > MAX_PER_WINDOW;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  let payload: { email?: unknown; ref?: unknown; hp?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  // Honeypot: real users never fill the hidden field. Pretend success so bots
  // don't learn they were caught.
  if (typeof payload.hp === "string" && payload.hp.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const email =
    typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const ref =
    typeof payload.ref === "string" && payload.ref ? payload.ref : "blog";
  const origin = req.headers.get("origin") ?? new URL(req.url).origin;

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${origin}/auth/callback?next=/app&welcome=1`,
      data: { ref, signup_source: "blog-daily-edition" },
    },
  });

  if (error) {
    // Supabase surfaces its own OTP rate limit as an error string.
    const status = /rate|limit|too many/i.test(error.message) ? 429 : 502;
    return NextResponse.json(
      { error: "send_failed", detail: error.message },
      { status }
    );
  }

  return NextResponse.json({ ok: true });
}
