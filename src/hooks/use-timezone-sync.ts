/**
 * Silently keeps user_preferences.timezone in sync with the browser's
 * detected IANA timezone. Runs once per mount; no UI, no toast.
 *
 * Why: the daily-digest cron formats task times in the user's stored
 * timezone. If timezone is null/UTC, times appear in UTC regardless of
 * where the user actually is.
 */
"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUserPrefs } from "@/hooks/use-ai";

export function useTimezoneSync() {
  const { data: prefs } = useUserPrefs();

  useEffect(() => {
    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!browserTz) return;

    // Only write if stored value differs or is missing — avoids a pointless
    // DB round-trip on every page load once the value is correct.
    const storedTz = prefs?.timezone;
    if (storedTz === browserTz) return;

    (async () => {
      const supabase = createClient();
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      await supabase
        .from("user_preferences")
        .upsert({ user_id: u.user.id, timezone: browserTz });
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs?.timezone]);
}
