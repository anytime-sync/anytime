import { NextResponse } from "next/server";

const INDEXNOW_KEY = "cd861ba1da38969a222b50f16bb764f1faf05e9e28e18f85752eee0207dab97a";

const FL_URLS = [
  "https://firstlight.to/",
  "https://firstlight.to/pricing",
  "https://firstlight.to/mcp",
  "https://firstlight.to/blog",
  "https://firstlight.to/blog/best-ai-task-managers-2026",
  "https://firstlight.to/blog/first-light-vs-todoist-vs-things-vs-ticktick",
  "https://firstlight.to/blog/how-to-plan-your-day-with-ai",
  "https://firstlight.to/blog/your-morning-shouldnt-start-with-a-to-do-list",
  "https://firstlight.to/blog/why-i-built-first-light",
  "https://firstlight.to/changelog",
  "https://firstlight.to/signup",
];

const OQUA_URLS = [
  "https://www.oqua.com/",
  "https://www.oqua.com/articles",
  "https://www.oqua.com/wellness",
  "https://www.oqua.com/culture",
  "https://www.oqua.com/style",
  "https://www.oqua.com/home",
];

async function submitIndexNow(host: string, urls: string[]) {
  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host,
        key: INDEXNOW_KEY,
        keyLocation: "https://" + host + "/" + INDEXNOW_KEY + ".txt",
        urlList: urls,
      }),
    });
    return { status: res.status, ok: res.ok };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function POST() {
  const results: Record<string, any> = {};

  // Submit First Light to IndexNow
  results.firstlight_indexnow = await submitIndexNow("firstlight.to", FL_URLS);

  // Submit OQUA to IndexNow
  results.oqua_indexnow = await submitIndexNow("www.oqua.com", OQUA_URLS);

  // Ping Google sitemaps
  const sitemaps = [
    { name: "google_fl", url: "https://firstlight.to/sitemap.xml" },
    { name: "google_oqua", url: "https://www.oqua.com/sitemap.xml" },
  ];
  for (const sm of sitemaps) {
    try {
      const res = await fetch(
        "https://www.google.com/ping?sitemap=" + encodeURIComponent(sm.url)
      );
      results[sm.name] = { status: res.status };
    } catch (e: any) {
      results[sm.name] = { error: e.message };
    }
  }

  return NextResponse.json(results);
}

export async function GET() {
  return NextResponse.json({
    message: "POST to ping Google + IndexNow for First Light and OQUA",
  });
}
