"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

type Announcement = {
  id: string;
  message: string;
  link_url: string | null;
  link_text: string | null;
  style: "info" | "success" | "warning" | "accent";
  bg_color: string | null;
  text_color: string | null;
  border_color: string | null;
};

const STYLE_CLASSES: Record<string, string> = {
  info: "bg-blue-50 text-blue-800 border-blue-200",
  success: "bg-emerald-50 text-emerald-800 border-emerald-200",
  warning: "bg-amber-50 text-amber-800 border-amber-200",
  accent: "bg-accent/5 text-accent border-accent/20",
};

/**
 * In-app announcement banner. Reads active announcements from Supabase
 * and displays the most recent one. User can dismiss (stored in sessionStorage).
 *
 * Supports per-announcement custom colors (bg_color, text_color, border_color)
 * set via /admin/format. When custom colors are present, they override the
 * style-based Tailwind classes via inline styles.
 */
export function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    const stored = sessionStorage.getItem("fl_dismissed_announcements");
    if (stored) {
      try {
        setDismissed(new Set(JSON.parse(stored)));
      } catch {}
    }

    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("announcements")
        .select("id, message, link_url, link_text, style, bg_color, text_color, border_color")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) setAnnouncement(data as Announcement);
    })();
  }, []);

  if (!announcement || dismissed.has(announcement.id)) return null;

  function handleDismiss() {
    if (!announcement) return;
    const next = new Set(dismissed);
    next.add(announcement.id);
    setDismissed(next);
    sessionStorage.setItem(
      "fl_dismissed_announcements",
      JSON.stringify([...next])
    );
  }

  const hasCustomColors = announcement.bg_color || announcement.text_color || announcement.border_color;

  return (
    <div
      className={cn(
        "border-b px-4 py-2.5 text-sm flex items-center justify-center gap-3",
        !hasCustomColors && (STYLE_CLASSES[announcement.style] ?? STYLE_CLASSES.accent)
      )}
      style={hasCustomColors ? {
        backgroundColor: announcement.bg_color || undefined,
        color: announcement.text_color || undefined,
        borderBottomColor: announcement.border_color || undefined,
      } : undefined}
    >
      <span>{announcement.message}</span>
      {announcement.link_url && (
        <Link
          href={announcement.link_url}
          className="underline underline-offset-2 font-medium hover:opacity-80"
        >
          {announcement.link_text ?? "Learn more"}
        </Link>
      )}
      <button
        onClick={handleDismiss}
        className="ml-2 p-0.5 rounded hover:bg-black/5"
        aria-label="Dismiss"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
