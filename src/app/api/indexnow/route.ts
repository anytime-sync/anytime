import { NextResponse } from "next/server";

const INDEXNOW_KEY = "cd861ba1da38969a222b50f16bb764f1faf05e9e28e18f85752eee0207dab97a";
const SITE = "https://firstlight.to";

const URLS = [
  "/",
  "/pricing",
  "/mcp",
  "/blog",
  "/blog/best-ai-task-managers-2026",
  "/blog/first-light-vs-todoist-vs-things-vs-ticktick",
  "/blog/how-to-plan-your-day-with-ai",
  "/blog/your-morning-shouldnt-start-with-a-to-do-list",
  "/blog/why-i-built-first-light",
  "/changelog",
  "/signup",
];

export async function POST(req: Request) {
  // Verify request is authorized
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = req.json().catch(() => null);
    const urlList = (await body)?.urls || URLS.map((p) => SITE + p);

    const response = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host: "firstlight.to",
        key: INDEXNOW_KEY,
        keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`,
        urlList,
      }),
    });

    const status = response.status;
    const text = await response.text();

    // Also ping Google
    const googlePing = await fetch(
      `https://www.google.com/ping?sitemap=${encodeURIComponent(SITE + "/sitemap.xml")}`
    ).then((r) => r.status).catch(() => "failed");

    return NextResponse.json({
      indexnow: { status, body: text },
      googlePing,
      urlsSubmitted: urlList.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
