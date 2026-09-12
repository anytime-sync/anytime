import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Retired legacy callback: it used to log OAuth tokens without persisting
 * them and incorrectly reported a live connection. Existing OAuth 1.0a
 * credentials stay in the server-only store; admin verification is separate.
 */
export async function GET() {
  return new NextResponse(
    "This legacy X authorization callback is retired. Use the X connection page in First Light administration to verify the saved account.",
    { status: 410, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } },
  );
}
