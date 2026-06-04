"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { Plus, Trash2, Eye, EyeOff, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Announcement = {
  id: string;
  message: string;
  link_url: string | null;
  link_text: string | null;
  style: "info" | "success" | "warning" | "accent";
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  target_plans: string[] | null; // null = all
  created_at: string;
};

export default function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  // Form state
  const [message, setMessage] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [style, setStyle] = useState<"info" | "success" | "warning" | "accent">("accent");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/announcements");
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleCreate() {
    if (!message.trim()) {
      toast.error("Message is required");
      return;
    }
    const res = await fetch("/api/admin/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: message.trim(),
        link_url: linkUrl.trim() || null,
        link_text: linkText.trim() || null,
        style,
      }),
    });
    if (res.ok) {
      toast.success("Announcement created");
      setEditing(false);
      setMessage("");
      setLinkUrl("");
      setLinkText("");
      load();
    } else {
      toast.error("Failed to create announcement");
    }
  }

  async function toggleActive(id: string, active: boolean) {
    await fetch(`/api/admin/announcements/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    load();
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this announcement?")) return;
    await fetch(`/api/admin/announcements/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="px-8 md:px-12 py-12 max-w-6xl">
      <header className="mb-12">
        <p className="editorial-number text-[11px] mb-3">
          The Admin Edition · No. 10
        </p>
        <h1 className="font-display text-5xl md:text-6xl tracking-tight leading-[1.05]">
          Announcements<em className="font-display">, from the top.</em>
        </h1>
        <p className="text-sm text-muted-fg mt-4 italic font-display">
          In-app banners shown to all (or targeted) users.
        </p>
        <div className="mt-8 h-px bg-accent/40 w-24" />
      </header>

      {!editing ? (
        <button
          onClick={() => setEditing(true)}
          className="mb-8 inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border hover:bg-muted/60 text-sm transition-colors"
        >
          <Plus className="size-4" />
          New Announcement
        </button>
      ) : (
        <div className="mb-12 surface border border-border rounded-lg p-6 space-y-4">
          <div>
            <label className="text-xs text-muted-fg uppercase tracking-wider block mb-1.5">
              Message
            </label>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="We just launched Plus tier! Upgrade now for smart reschedule and more."
              className="w-full px-3 py-2 rounded-md border border-border bg-bg text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-fg uppercase tracking-wider block mb-1.5">
                Link URL (optional)
              </label>
              <input
                type="text"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="/pricing"
                className="w-full px-3 py-2 rounded-md border border-border bg-bg text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-fg uppercase tracking-wider block mb-1.5">
                Link Text
              </label>
              <input
                type="text"
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                placeholder="Learn more"
                className="w-full px-3 py-2 rounded-md border border-border bg-bg text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-fg uppercase tracking-wider block mb-1.5">
              Style
            </label>
            <div className="flex gap-2">
              {(["accent", "info", "success", "warning"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStyle(s)}
                  className={cn(
                    "px-3 py-1.5 rounded text-xs capitalize border",
                    style === s
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border text-muted-fg hover:text-fg"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleCreate}
              className="px-4 py-2 rounded-md bg-accent text-white text-sm hover:bg-accent/90"
            >
              Create
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-4 py-2 text-sm text-muted-fg hover:text-fg"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Active announcements */}
      <section>
        <p className="editorial-number text-[10px] mb-4">All Announcements</p>
        {loading ? (
          <p className="text-sm text-muted-fg italic">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-fg italic">No announcements yet.</p>
        ) : (
          <div className="space-y-2">
            {items.map((a) => (
              <div
                key={a.id}
                className={cn(
                  "surface border rounded-md px-4 py-3 flex items-center justify-between",
                  a.active ? "border-accent/30" : "border-border opacity-60"
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Megaphone className={cn("size-4 shrink-0", a.active ? "text-accent" : "text-muted-fg")} />
                    <p className="text-sm font-medium truncate">{a.message}</p>
                  </div>
                  <p className="text-xs text-muted-fg mt-1">
                    {a.style} · {format(new Date(a.created_at), "MMM d")}
                    {a.link_url && ` · ${a.link_text ?? a.link_url}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => toggleActive(a.id, !a.active)}
                    className="p-1.5 rounded hover:bg-muted/60"
                    title={a.active ? "Deactivate" : "Activate"}
                  >
                    {a.active ? (
                      <Eye className="size-4 text-accent" />
                    ) : (
                      <EyeOff className="size-4 text-muted-fg" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(a.id)}
                    className="p-1.5 rounded hover:bg-muted/60"
                    title="Delete"
                  >
                    <Trash2 className="size-4 text-muted-fg hover:text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
