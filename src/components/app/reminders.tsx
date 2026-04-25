"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Task } from "@/lib/db.types";
import { useUIStore } from "@/store/ui";
import { Bell, BellOff } from "lucide-react";

/**
 * Mounted once in the AppShell.
 * - Asks (once) for Notification permission via a small bell button if not set.
 * - Polls for upcoming reminders within the next hour and schedules timeouts.
 * - Fires browser notifications at reminder_at; clicking focuses the window
 *   and opens the task in the detail panel.
 */
export function Reminders() {
  const setSelected = useUIStore((s) => s.setSelectedTaskId);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission
  );
  const timeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const { data: upcoming = [] } = useQuery({
    queryKey: ["upcoming-reminders"],
    queryFn: async () => {
      const supabase = createClient();
      const now = new Date();
      const end = new Date(now.getTime() + 60 * 60 * 1000); // +1h
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, reminder_at, due_at")
        .eq("is_completed", false)
        .not("reminder_at", "is", null)
        .gte("reminder_at", now.toISOString())
        .lte("reminder_at", end.toISOString());
      if (error) throw error;
      return (data ?? []) as Pick<Task, "id" | "title" | "reminder_at" | "due_at">[];
    },
    refetchInterval: 60_000,
  });

  // (Re)schedule timeouts whenever the upcoming list changes.
  useEffect(() => {
    const map = timeouts.current;
    // clear stale
    for (const [id, timer] of map) {
      if (!upcoming.find((u) => u.id === id)) {
        clearTimeout(timer);
        map.delete(id);
      }
    }
    // add new
    for (const u of upcoming) {
      if (!u.reminder_at || map.has(u.id)) continue;
      const ms = new Date(u.reminder_at).getTime() - Date.now();
      if (ms < 0 || ms > 60 * 60 * 1000) continue;
      const t = setTimeout(() => {
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          const n = new Notification("Anytime — reminder", {
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
      map.set(u.id, t);
    }
    return () => {
      // don't clear on every render; only on unmount
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upcoming]);

  // Cleanup all on unmount.
  useEffect(() => {
    const map = timeouts.current;
    return () => {
      for (const t of map.values()) clearTimeout(t);
      map.clear();
    };
  }, []);

  if (perm === "unsupported") return null;

  // Subtle bell icon in the corner; only visible when permission isn't granted.
  if (perm === "granted") return null;

  return (
    <button
      title="Enable browser reminders"
      className="fixed bottom-4 right-4 z-30 size-10 rounded-full bg-panel border border-border shadow-md grid place-items-center text-muted-fg hover:text-accent"
      onClick={async () => {
        const result = await Notification.requestPermission();
        setPerm(result);
      }}
    >
      {perm === "denied" ? <BellOff className="size-4" /> : <Bell className="size-4" />}
    </button>
  );
}
