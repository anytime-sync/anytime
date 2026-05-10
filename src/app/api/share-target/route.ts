import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/share-target — receives a Web Share Target request from the OS
 * (Android share sheet, iOS share-to-installed-PWA on supported builds).
 *
 * Manifest declares this as a GET share_target. We collapse the title /
 * text / url params into one quick-add seed string and 302 to
 * /app/today?quickadd=<encoded>, where the layout reads the param and
 * pre-fills the quick-add input.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const title = url.searchParams.get("title") ?? "";
  const text = url.searchParams.get("text") ?? "";
  const linkUrl = url.searchParams.get("url") ?? "";

  // Compose: prefer text, append url on a new line if both present.
  const parts: string[] = [];
  if (title) parts.push(title);
  if (text && text !== title) parts.push(text);
  if (linkUrl && linkUrl !== text) parts.push(linkUrl);
  const seed = parts.join(" — ").trim();

  const target = new URL("/app/today", url.origin);
  if (seed) target.searchParams.set("quickadd", seed);
  return NextResponse.redirect(target.toString(), { status: 302 });
}
