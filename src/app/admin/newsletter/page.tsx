"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { Send, Users, Eye, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type BroadcastRow = {
  id: string;
  subject: string;
  body_html: string;
  body_text: string;
  audience: "all" | "plus" | "pro" | "free";
  status: "draft" | "sending" | "sent" | "failed";
  sent_count: number | null;
  created_at: string;
  sent_at: string | null;
};

export default function NewsletterPage() {
  const [drafts, setDrafts] = useState<BroadcastRow[]>([]);
  const [sent, setSent] = useState<BroadcastRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Compose state
  const [composing, setComposing] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<"all" | "plus" | "pro" | "free">("all");
  const [sending, setSending] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  async function loadBroadcasts() {
    setLoading(true);
    const res = await fetch("/api/admin/newsletter");
    if (res.ok) {
      const data = await res.json();
      setDrafts(data.filter((b: BroadcastRow) => b.status === "draft"));
      setSent(data.filter((b: BroadcastRow) => b.status !== "draft"));
    }
    setLoading(false);
  }

  useEffect(() => {
    loadBroadcasts();
  }, []);

  async function handleSaveDraft() {
    if (!subject.trim()) {
      toast.error("Subject is required");
      return;
    }
    const res = await fetch("/api/admin/newsletter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, body, audience, action: "draft" }),
    });
    if (res.ok) {
      toast.success("Draft saved");
      setComposing(false);
      setSubject("");
      setBody("");
      loadBroadcasts();
    } else {
      toast.error("Failed to save draft");
    }
  }

  async function handleSend(id?: string) {
    const confirmed = window.confirm(
      "Send this broadcast to all matching users? This cannot be undone."
    );
    if (!confirmed) return;

    setSending(true);
    const endpoint = id
      ? `/api/admin/newsletter/${id}/send`
      : "/api/admin/newsletter";
    const payload = id
      ? {}
      : { subject, body, audience, action: "send" };
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSending(false);

    if (res.ok) {
      const data = await res.json();
      toast.success(`Broadcast sent to ${data.sent_count ?? "?"} users`);
      setComposing(false);
      setSubject("");
      setBody("");
      loadBroadcasts();
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Send failed");
    }
  }

  return (
    <div className="px-8 md:px-12 py-12 max-w-6xl">
      <header className="mb-12">
        <p className="editorial-number text-[11px] mb-3">
          The Admin Edition · No. 09
        </p>
        <h1 className="font-display text-5xl md:text-6xl tracking-tight leading-[1.05]">
          Newsletter<em className="font-display">, dispatches.</em>
        </h1>
        <p className="text-sm text-muted-fg mt-4 italic font-display">
          Communicate with your users via email broadcast.
        </p>
        <div className="mt-8 h-px bg-accent/40 w-24" />
      </header>

      {/* Compose */}
      {!composing ? (
        <button
          onClick={() => setComposing(true)}
          className="mb-8 inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border hover:bg-muted/60 text-sm transition-colors"
        >
          <Send className="size-4" />
          New Broadcast
        </button>
      ) : (
        <div className="mb-12 surface border border-border rounded-lg p-6 space-y-4">
          <div>
            <label className="text-xs text-muted-fg uppercase tracking-wider block mb-1.5">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="What's new in First Light…"
              className="w-full px-3 py-2 rounded-md border border-border bg-bg text-sm focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div>
            <label className="text-xs text-muted-fg uppercase tracking-wider block mb-1.5">
              Audience
            </label>
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value as any)}
              className="px-3 py-2 rounded-md border border-border bg-bg text-sm"
            >
              <option value="all">All users</option>
              <option value="free">Free only</option>
              <option value="plus">Plus & above</option>
              <option value="pro">Pro only</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-muted-fg uppercase tracking-wider block mb-1.5">
              Body (markdown)
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              placeholder="Write your broadcast in markdown…"
              className="w-full px-3 py-2 rounded-md border border-border bg-bg text-sm font-mono focus:outline-none focus:ring-1 focus:ring-accent resize-y"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSaveDraft}
              className="px-4 py-2 rounded-md border border-border hover:bg-muted/60 text-sm transition-colors"
            >
              Save Draft
            </button>
            <button
              onClick={() => handleSend()}
              disabled={sending || !subject.trim()}
              className={cn(
                "px-4 py-2 rounded-md text-sm transition-colors inline-flex items-center gap-2",
                "bg-accent text-white hover:bg-accent/90",
                (sending || !subject.trim()) && "opacity-50 cursor-not-allowed"
              )}
            >
              <Send className="size-3.5" />
              {sending ? "Sending…" : "Send Now"}
            </button>
            <button
              onClick={() => {
                setComposing(false);
                setSubject("");
                setBody("");
              }}
              className="px-4 py-2 text-sm text-muted-fg hover:text-fg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Drafts */}
      {drafts.length > 0 && (
        <section className="mb-12">
          <p className="editorial-number text-[10px] mb-4">Drafts</p>
          <div className="space-y-2">
            {drafts.map((d) => (
              <div
                key={d.id}
                className="surface border border-border rounded-md px-4 py-3 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-medium">{d.subject}</p>
                  <p className="text-xs text-muted-fg">
                    {d.audience} · {format(new Date(d.created_at), "MMM d, h:mm a")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSend(d.id)}
                    className="px-3 py-1.5 rounded text-xs bg-accent text-white hover:bg-accent/90 inline-flex items-center gap-1"
                  >
                    <Send className="size-3" /> Send
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Sent history */}
      <section>
        <p className="editorial-number text-[10px] mb-4">Sent</p>
        {loading ? (
          <p className="text-sm text-muted-fg italic">Loading…</p>
        ) : sent.length === 0 ? (
          <p className="text-sm text-muted-fg italic">No broadcasts sent yet.</p>
        ) : (
          <div className="border border-border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 text-left text-xs text-muted-fg uppercase tracking-wider">
                  <th className="px-4 py-3 font-medium">Subject</th>
                  <th className="px-4 py-3 font-medium">Audience</th>
                  <th className="px-4 py-3 font-medium">Sent to</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sent.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{s.subject}</td>
                    <td className="px-4 py-3 text-xs uppercase">{s.audience}</td>
                    <td className="px-4 py-3">{s.sent_count ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-fg">
                      {s.sent_at
                        ? format(new Date(s.sent_at), "MMM d, h:mm a")
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-block px-2 py-0.5 rounded text-xs font-medium",
                          s.status === "sent"
                            ? "bg-emerald-50 text-emerald-700"
                            : s.status === "failed"
                            ? "bg-red-50 text-red-700"
                            : "bg-zinc-100 text-zinc-500"
                        )}
                      >
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
