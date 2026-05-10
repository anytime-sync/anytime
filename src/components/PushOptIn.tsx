"use client";

import { useEffect, useState } from "react";
import {
  pushPermissionState,
  requestPushPermission,
  subscribePush,
} from "@/lib/push-client";

const DISMISS_KEY = "fl.push.optin.dismissed";

/**
 * Banner offering push notification opt-in. Rules:
 *   - Only renders if Notification API exists AND permission is "default"
 *     AND user hasn't dismissed before AND task count >= 3.
 *   - Dismissal is permanent (re-prompt only if user manually re-enables
 *     in the Settings page).
 *   - Click "Enable" requests permission + subscribes. Dismissal is
 *     stored in localStorage.
 */
export function PushOptIn({ taskCount }: { taskCount: number }) {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      if (typeof window === "undefined") return;
      if (taskCount < 3) return;
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
      const perm = await pushPermissionState();
      if (perm === "default") setShow(true);
    })();
  }, [taskCount]);

  if (!show) return null;

  async function enable() {
    setBusy(true);
    try {
      const perm = await requestPushPermission();
      if (perm !== "granted") {
        localStorage.setItem(DISMISS_KEY, "1");
        setShow(false);
        return;
      }
      await subscribePush();
    } finally {
      setBusy(false);
      setShow(false);
    }
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  }

  return (
    <div className="border border-amber-200 bg-amber-50 text-amber-900 rounded-lg p-3 my-3 flex items-start gap-3">
      <div className="flex-1 text-sm">
        <div className="font-medium">Get a nudge when reminders fire</div>
        <div className="opacity-80">
          We'll send a quiet push for due tasks and the morning brief. You can
          turn it off any time in Settings.
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          onClick={dismiss}
          className="text-sm px-3 py-1.5 rounded hover:bg-amber-100"
        >
          Not now
        </button>
        <button
          onClick={enable}
          disabled={busy}
          className="text-sm px-3 py-1.5 rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {busy ? "Setting up…" : "Enable"}
        </button>
      </div>
    </div>
  );
}
