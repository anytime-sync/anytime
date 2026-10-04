/**
 * Initializes a missing account timezone from the browser.
 * Existing account choices are preserved across devices and travel.
 *
 * Digest delivery uses the stored account zone. Settings offers an explicit
 * device-zone action so opening a browser cannot silently shift reminders.
 */
"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUserPrefs } from "@/hooks/use-ai";

export function useTimezoneSync() {
  const { data: prefs, isSuccess } = useUserPrefs();

  useEffect(() => {
    if (!isSuccess || prefs?.timezone) return;
    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!browserTz) return;

    (async () => {
      const supabase = createClient();
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      await supabase
        .from("user_preferences")
        .upsert({ user_id: u.user.id, timezone: browserTz });
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess, prefs?.timezone]);
}
