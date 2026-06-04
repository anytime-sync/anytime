"use client";

import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

/**
 * Vercel Analytics + Speed Insights — same setup as OQUA.
 * Filters out /admin routes so internal usage doesn't pollute metrics.
 * Zero config, zero cookies, Vercel-hosted — just works on deploy.
 */
export function AnalyticsWrapper() {
  return (
    <>
      <Analytics
        beforeSend={(event) => {
          if (event.url.includes("/admin")) return null;
          return event;
        }}
      />
      <SpeedInsights
        beforeSend={(data) => {
          if (data.url.includes("/admin")) return null;
          return data;
        }}
      />
    </>
  );
}
