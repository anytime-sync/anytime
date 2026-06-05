import { NextResponse } from "next/server";

/**
 * POST /api/gsc/ping
 * Pings Google & Bing about our sitemap.
 * Deployed on Vercel, this can reach any external API.
 */
export async function POST() {
  const results: Record<string, any> = {};

  // Google sitemap ping
  try {
    const googleRes = await fetch(
      "https://www.google.com/ping?sitemap=" +
        encodeURIComponent("https://firstlight.to/sitemap.xml")
    );
    results.google = { status: googleRes.status, ok: googleRes.ok };
  } catch (e: any) {
    results.google = { error: e.message };
  }

  // Bing sitemap ping
  try {
    const bingRes = await fetch(
      "https://www.bing.com/ping?sitemap=" +
        encodeURIComponent("https://firstlight.to/sitemap.xml")
    );
    results.bing = { status: bingRes.status, ok: bingRes.ok };
  } catch (e: any) {
    results.bing = { error: e.message };
  }

  // IndexNow batch submission
  try {
    const indexNowRes = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host: "firstlight.to",
        key: "cd861ba1da38969a222b50f16bb764f1faf05e9e28e18f85752eee0207dab97a",
        keyLocation: "https://firstlight.to/cd861ba1da38969a222b50f16bb764f1faf05e9e28e18f85752eee0207dab97a.txt",
        urlList: [
          "https://firstlight.to/",
          "https://firstlight.to/pricing",
          "https://firstlight.to/mcp",
          "https://firstlight.to/blog",
          "https://firstlight.to/changelog",
          "https://firstlight.to/signup",
        ],
      }),
    });
    results.indexnow = { status: indexNowRes.status };
  } catch (e: any) {
    results.indexnow = { error: e.message };
  }

  return NextResponse.json(results);
}

export async function GET() {
  return NextResponse.json({
    message: "POST to this endpoint to ping search engines about the sitemap",
  });
}
