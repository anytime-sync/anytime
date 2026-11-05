"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Task } from "@/lib/db.types";
import { useUIStore } from "@/store/ui";
import { Bell, BellOff } from "lucide-react";
import { useLanguage } from "@/lib/use-language";
import { t } from "@/lib/i18n";

/**
 * Mounted once in the AppShell.
 * - Asks (once) for Notification permission via a small bell button if not set.
 * - Polls for upcoming reminders within the next hour and schedules timeouts.
 * - Fires browser notifications at reminder_at; clicking focuses the window
 *   and opens the task in the detail panel.
 */
export function Reminders() {
  const lang = useLanguage();
  const setSelected = useUIStore((s) => s.setSelectedTaskId);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission
  );
  const timeouts = useRef<Map<string, { timer: ReturnType<typeof setTimeout>; revision: string }>>(new Map());

  const [resume, setResume] = useState(0);
  const { data: upcoming = [], refetch } = useQuery({
    queryKey: ["upcoming-reminders"],
    queryFn: async () => {
      const supabase = createClient();
      const now = new Date();
      const end = new Date(now.getTime() + 60 * 60 * 1000); // +1h
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, reminder_at, due_at, updated_at")
        .eq("is_completed", false)
        .not("reminder_at", "is", null)
        .gte("reminder_at", now.toISOString())
        .lte("reminder_at", end.toISOString());
      if (error) throw error;
      return (data ?? []) as Pick<Task, "id" | "title" | "reminder_at" | "due_at" | "updated_at">[];
    },
    refetchInterval: 60_000,
  });

  // (Re)schedule timeouts whenever the upcoming list changes.
  useEffect(() => {
    const map = timeouts.current;
    const revision = (u: typeof upcoming[number]) => JSON.stringify([u.reminder_at, u.title, u.updated_at]);
    for (const [id, saved] of map) {
      const row = upcoming.find(u => u.id === id);
      if (!row || saved.revision !== revision(row)) { clearTimeout(saved.timer); map.delete(id); }
    }
    // add new
    for (const u of upcoming) {
      if (!u.reminder_at || map.has(u.id)) continue;
      const ms = new Date(u.reminder_at).getTime() - Date.now();
      if (ms < 0 || ms > 60 * 60 * 1000) continue;
      const t = setTimeout(() => {
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          const n = new Notification("First Light — reminder", {
            body: u.title,
            icon: "/icons/icon-192.png",
            tag: u.id,
          });
          n.onclick = () => {
            window.focus();
            setSelected(u.id);
            n.close();
          };
        }
        map.delete(u.id);
      }, ms);
      map.set(u.id, { timer: t, revision: revision(u) });
    }
    return () => {
      // don't clear on every render; only on unmount
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upcoming, resume, setSelected]);

  // Cleanup all on unmount.
  useEffect(() => {
    const map = timeouts.current;
    return () => {
      for (const t of map.values()) clearTimeout(t.timer);
      map.clear();
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const refresh = () => {
      for (const saved of timeouts.current.values()) clearTimeout(saved.timer);
      timeouts.current.clear();
      void Promise.resolve(refetch()).then(() => { if (mounted) setResume(v => v + 1); }).catch(() => { /* Keep stale timers cancelled until a successful refresh. */ });
    };
    const visible = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', visible);
    return () => { mounted = false; window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', visible); };
  }, [refetch]);

  if (perm === "unsupported") return null;

  // Subtle bell icon in the corner; only visible when permission isn't granted.
  if (perm === "granted") return null;

  return (
    <button
      title={t(lang, "reminders.enable")}
      className="fixed bottom-4 right-4 z-30 size-10 rounded-full surface border border-border shadow-md grid place-items-center text-muted-fg hover:text-accent"
      onClick={async () => {
        const result = await Notification.requestPermission();
        setPerm(result);
      }}
    >
      {perm === "denied" ? <BellOff className="size-4" /> : <Bell className="size-4" />}
    </button>
  );
}
