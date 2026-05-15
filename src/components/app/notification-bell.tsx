"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, Check, X } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/use-language";
import { t as tr, getLanguage } from "@/lib/i18n";

type Notification = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  payload: Record<string, unknown> | null;
  action_url: string | null;
  read_at: string | null;
  created_at: string;
};

/**
 * Bell icon with an unread badge. Click reveals a dropdown listing the
 * 20 most recent notifications. Items can be dismissed individually or
 * all marked as read at once. Polls /api/notifications every 30s while
 * the app is mounted so the badge stays fresh without realtime.
 */
export function NotificationBell({ collapsed }: { collapsed?: boolean }) {
  const lang = useLanguage();
  const dfLocale = getLanguage(lang).dateFnsLocale;
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  async function load() {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const j = await res.json();
      setNotifications((j.rows ?? []) as Notification[]);
      setUnread(j.unread ?? 0);
    } catch {}
  }

  // Initial load + Supabase realtime subscription. We still keep a slow
  // 5-minute sanity poll in case the WS connection drops or a missed
  // event leaves us out of sync.
  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    (async () => {
      await load();
      if (cancelled) return;

      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;

        const channel = supabase
          .channel(`notifications:${user.id}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "app_notifications",
              filter: `user_id=eq.${user.id}`,
            },
            () => {
              // Any change (insert/update/delete) → refetch the inbox.
              // Cheaper than reconciling rows by hand and avoids drift
              // when the trigger writes multiple rows in one txn.
              load();
            }
          )
          .subscribe();

        unsubscribe = () => {
          supabase.removeChannel(channel);
        };
      } catch {
        // Realtime is best-effort; the slow poll below keeps us correct
        // even if the WebSocket never opens.
      }
    })();

    const slowPoll = setInterval(load, 5 * 60_000);
    return () => {
      cancelled = true;
      clearInterval(slowPoll);
      unsubscribe?.();
    };
  }, []);

  // Click-outside to close
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!open) return;
      const target = e.target as Node;
      if (popRef.current?.contains(target)) return;
      if (btnRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  async function markRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, read_at: new Date().toISOString() } : n
      )
    );
    setUnread((u) => Math.max(0, u - 1));
    await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ read: true }),
    });
  }

  async function dismiss(id: string) {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await fetch(`/api/notifications/${id}`, { method: "DELETE" });
    load();
  }

  async function markAllRead() {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() }))
    );
    setUnread(0);
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mark_all_read: true }),
    });
  }

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "relative inline-flex items-center justify-center rounded-md hover:bg-muted/60 transition-colors",
          collapsed ? "w-10 h-10" : "w-full h-9 gap-2 px-2 text-sm text-muted-fg hover:text-fg"
        )}
        title={tr(lang, "sidebar.notifications")}
        aria-label={tr(lang, "sidebar.notifications.aria").replace("{n}", String(unread))}
      >
        <Bell className="size-4" />
        {!collapsed && <span>{tr(lang, "sidebar.notifications")}</span>}
        {unread > 0 && (
          <span
            className={cn(
              "absolute grid place-items-center rounded-full bg-danger text-white text-[9px] font-semibold leading-none",
              collapsed
                ? "top-1.5 right-1.5 size-4"
                : "top-1 right-2 h-4 min-w-[16px] px-1"
            )}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={popRef}
          className="absolute z-50 left-full ml-2 bottom-0 w-[340px] surface-strong border border-border rounded-lg shadow-2xl overflow-hidden"
          style={{ maxHeight: "70vh" }}
        >
          <div className="px-3 h-10 border-b border-border flex items-center justify-between">
            <span className="text-sm font-semibold">{tr(lang, "sidebar.notifications")}</span>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[11px] text-muted-fg hover:text-fg underline"
                >
                  {tr(lang, "sidebar.notifications.markAllRead")}
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="size-6 grid place-items-center rounded hover:bg-muted text-muted-fg"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>

          <div className="overflow-y-auto" style={{ maxHeight: "calc(70vh - 40px)" }}>
            {notifications.length === 0 && (
              <p className="text-center text-muted-fg italic py-8 text-sm">
                {tr(lang, "sidebar.notifications.allCaught")}
              </p>
            )}
            {notifications.map((n) => {
              const isUnread = !n.read_at;
              const Inner = (
                <div
                  className={cn(
                    "px-3 py-2.5 border-b border-border last:border-0 hover:bg-muted/30 transition-colors",
                    isUnread && "bg-accent/5"
                  )}
                >
                  <div className="flex items-start gap-2">
                    {isUnread && (
                      <span className="mt-1.5 inline-block size-1.5 rounded-full bg-accent shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className={cn("text-sm", isUnread && "font-medium")}>
                        {n.title}
                      </div>
                      {n.body && (
                        <div className="text-xs text-muted-fg mt-0.5 line-clamp-2">
                          {n.body}
                        </div>
                      )}
                      <div className="text-[10px] text-muted-fg mt-1">
                        {format(new Date(n.created_at), "MMM d, h:mm a", { locale: dfLocale })}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      {isUnread && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            markRead(n.id);
                          }}
                          className="size-6 grid place-items-center rounded hover:bg-muted text-muted-fg"
                          title={tr(lang, "sidebar.notifications.markRead")}
                        >
                          <Check className="size-3" />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          dismiss(n.id);
                        }}
                        className="size-6 grid place-items-center rounded hover:bg-muted text-muted-fg"
                        title={tr(lang, "sidebar.notifications.dismiss")}
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
              return n.action_url ? (
                <Link
                  key={n.id}
                  href={n.action_url}
                  onClick={() => {
                    if (isUnread) markRead(n.id);
                    setOpen(false);
                  }}
                  className="block"
                >
                  {Inner}
                </Link>
              ) : (
                <div
                  key={n.id}
                  onClick={() => isUnread && markRead(n.id)}
                  className="cursor-pointer"
                >
                  {Inner}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
