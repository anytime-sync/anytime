import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { verifyUnsubToken } from "@/lib/unsub-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One-click unsubscribe for reminder emails. CAN-SPAM compliant.
 *
 * The link in every reminder includes an HMAC-signed token tying the
 * recipient's user_id to a server secret. Hitting this URL flips
 * user_preferences.email_reminders to false for that user.
 *
 * Returns a small confirmation HTML page (no auth required — the token
 * itself is the auth).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("t") ?? "";
  const userId = verifyUnsubToken(token);

  if (!userId) {
    return new NextResponse(htmlPage("Invalid link", "This unsubscribe link is invalid or expired. Please update your preferences from Settings instead."), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supaUrl   = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !supaUrl) {
    return new NextResponse(htmlPage("Server error", "We couldn't process this right now. Try again in a moment."), {
      status: 500, headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const admin = createSupabaseClient(supaUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await admin
    .from("user_preferences")
    .update({ email_reminders: false })
    .eq("user_id", userId);

  if (error) {
    console.error("[reminders.unsubscribe]", error);
    return new NextResponse(htmlPage("Could not unsubscribe", error.message), {
      status: 500, headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  return new NextResponse(htmlPage(
    "Unsubscribed",
    "You won't receive reminder emails from First Light anymore. You can re-enable them anytime under Settings → Notifications.",
  ), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function htmlPage(title: string, body: string): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${title} — First Light</title>
<meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;background:#FAF7F2;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#111;">
  <div style="max-width:480px;margin:80px auto;padding:32px;background:#fff;border:1px solid #ECE6D8;border-radius:8px;">
    <p style="margin:0 0 12px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#888;">First Light</p>
    <h1 style="margin:0 0 12px;font-family:Georgia,serif;font-size:24px;font-weight:400;">${title}</h1>
    <p style="margin:0;color:#555;line-height:1.55;">${body}</p>
  </div>
</body></html>`;
}
