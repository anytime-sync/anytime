import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/app";
  // Blog magic-link signups arrive with ?welcome=1 so the app can treat the
  // first /app load as a first-run (greet the user, highlight the pre-seeded
  // Daily Edition). Carry it through to the destination.
  const welcome = url.searchParams.get("welcome");

  if (code) {
    const supabase = createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  const dest = new URL(next, url.origin);
  if (welcome && !dest.searchParams.has("welcome")) {
    dest.searchParams.set("welcome", welcome);
  }
  return NextResponse.redirect(dest);
}
