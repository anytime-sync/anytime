// Real review UI; synthetic API only. No login, permission prompts or provider traffic.
const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");
const { build } = require("esbuild");
const { chromium } = require("playwright-core");
const root = path.resolve(__dirname, "../..");
(async () => {
  const bundle = await build({
    absWorkingDir: root,
    bundle: true,
    write: false,
    platform: "browser",
    format: "iife",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"test"' },
    stdin: {
      resolveDir: root,
      loader: "tsx",
      contents: `
      import React from 'react'; import {createRoot} from 'react-dom/client'; import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
      import {CalendarSyncReview} from './src/components/app/calendar-sync-review';
      const qc=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
      createRoot(document.getElementById('root')).render(<QueryClientProvider client={qc}><CalendarSyncReview/></QueryClientProvider>);`,
    },
  });
  const server = http.createServer((req, res) => {
    res.setHeader(
      "Content-Type",
      req.url === "/bundle.js" ? "application/javascript" : "text/html",
    );
    res.end(
      req.url === "/bundle.js"
        ? bundle.outputFiles[0].contents
        : '<div id="root"></div><script src="/bundle.js"></script>',
    );
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({
      executablePath: process.env.PW_EXE || "/usr/bin/chromium",
      headless: true,
      args: ["--no-sandbox"],
    });
    for (const scenario of ["accept", "stale", "unsupported"]) {
      const ctx = await browser.newContext({
        timezoneId: "America/Los_Angeles",
        serviceWorkers: "block",
      });
      const violations = [],
        errors = [],
        posts = [];
      let saved = false;
      await ctx.route("**/*", (route) => {
        const req = route.request(),
          url = new URL(req.url());
        if (url.origin !== origin) {
          violations.push(url.origin);
          return route.abort("blockedbyclient");
        }
        const json = (data, status = 200) =>
          route.fulfill({
            status,
            contentType: "application/json",
            body: JSON.stringify(data),
          });
        if (url.pathname === "/api/calendar/google/review") {
          if (req.method() === "POST") {
            posts.push(req.postDataJSON());
            if (scenario === "stale")
              return json(
                {
                  error:
                    "Either version changed. Refresh and review both versions again.",
                },
                409,
              );
            saved = true;
            return json({ ok: true });
          }
          if (url.searchParams.has("taskId"))
            return json({
              taskId: "task",
              review: "a".repeat(64),
              timezone: "Asia/Kathmandu",
              canAcceptCalendar: scenario !== "unsupported",
              limitation: "recurring_occurrence_edit_requires_review",
              local: {
                title: "Local fixture",
                notes: "Local notes",
                when: "Nov 6, 2026, 12:00 AM",
              },
              remote: {
                title: "Remote fixture",
                notes: "Remote notes",
                when: "Nov 6, 2026, 1:00 AM",
              },
            });
          return json({
            items: saved
              ? []
              : [
                  {
                    id: "task",
                    title: "Conflict fixture",
                    calendar_conflict: { reason: "both_sides_changed" },
                    calendar_event_id: "event",
                  },
                  {
                    id: "pending",
                    title: "Pending fixture",
                    calendar_conflict: null,
                  },
                ],
            truncated: false,
          });
        }
        if (
          url.pathname !== "/" &&
          url.pathname !== "/bundle.js" &&
          url.pathname !== "/favicon.ico"
        ) {
          violations.push(url.pathname);
          return route.abort();
        }
        return route.continue();
      });
      const page = await ctx.newPage();
      page.setDefaultTimeout(8000);
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(origin);
      await page.getByText("Pending fixture", { exact: true }).waitFor();
      await page.getByRole("button", { name: "Review versions" }).click();
      await page.getByText("Local fixture", { exact: true }).waitFor();
      await page.getByText("Remote fixture", { exact: true }).waitFor();
      if (scenario === "unsupported") {
        assert.equal(
          await page
            .getByRole("button", { name: "Use reviewed Google version" })
            .count(),
          0,
        );
        await page.getByText(/cannot be resolved here/).waitFor();
        await page
          .getByRole("button", { name: "Close without changes" })
          .click();
        assert.equal(posts.length, 0);
      } else {
        await page
          .getByRole("button", { name: "Use reviewed Google version" })
          .click();
        if (scenario === "stale") {
          await page.getByRole("alert").waitFor();
          assert.equal(
            await page
              .getByRole("button", { name: "Use reviewed Google version" })
              .count(),
            0,
          );
        } else await page.getByText("No pending task changes.").waitFor();
        assert.deepEqual(posts, [
          { taskId: "task", review: "a".repeat(64), choice: "calendar" },
        ]);
      }
      assert.deepEqual(violations, []);
      assert.deepEqual(errors, []);
      await ctx.close();
      console.log(`PASS calendar review ${scenario}`);
    }
    console.log(
      JSON.stringify({
        passed: 3,
        scope:
          "Synthetic API; real review UI; external traffic blocked; no provider acceptance",
      }),
    );
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
