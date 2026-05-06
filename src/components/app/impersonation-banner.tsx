"use client";

import { useEffect, useState } from "react";

/**
 * Sticky bar that appears at the top of /app whenever the admin is
 * impersonating another user. Reads the `fl.imp.target_email` marker
 * cookie set by /api/admin/impersonate/start. Clicking "Stop"
 * POSTs /api/admin/impersonate/stop and reloads.
 */
export function ImpersonationBanner() {
  const [target, setTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Parse cookies on mount; this only runs in the browser.
    const m = document.cookie.match(/(?:^|;\s*)fl\.imp\.target_email=([^;]+)/);
    if (m) setTarget(decodeURIComponent(m[1]));
  }, []);

  if (!target) return null;

  async function stop() {
    setBusy(true);
    try {
      await fetch("/api/admin/impersonate/stop", { method: "POST" });
    } finally {
      // Hard reload so server components re-fetch with the restored
      // admin session.
      window.location.href = "/admin/members";
    }
  }

  return (
    <div className="sticky top-0 z-40 w-full bg-amber-500 text-amber-950 border-b border-amber-700 shadow-sm">
      <div className="px-4 py-2 flex items-center justify-between gap-3 text-sm">
        <span className="truncate">
          You are impersonating <strong className="font-semibold">{target}</strong>.
        </span>
        <button
          type="button"
          onClick={stop}
          disabled={busy}
          className="shrink-0 inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-amber-950 text-amber-50 text-xs font-medium hover:bg-black/80 disabled:opacity-60"
        >
          {busy ? "Stopping…" : "Stop impersonating"}
        </button>
      </div>
    </div>
  );
}
