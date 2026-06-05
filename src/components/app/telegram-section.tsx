"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Copy, Check, RefreshCw, Trash2, MessageCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface TelegramLinkStatus {
  linked: boolean;
  telegram_id?: number;
  telegram_username?: string | null;
  linked_at?: string;
}

interface LinkToken {
  code: string;
  expiresAt: string;
  botUrl: string;
}

export function TelegramSection({ lang }: { lang: string }) {
  const [status, setStatus] = useState<TelegramLinkStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<LinkToken | null>(null);
  const [generating, setGenerating] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/account/telegram");
        if (!r.ok) throw new Error("load_failed");
        const data = await r.json();
        setStatus(data);
      } catch {
        // fail silently — section just won't show link status
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function generateCode() {
    setGenerating(true);
    try {
      const r = await fetch("/api/account/telegram/link-token", {
        method: "POST",
      });
      if (!r.ok) throw new Error("generate_failed");
      const data = await r.json();
      setToken(data);
    } catch (e: any) {
      toast.error("Failed to generate code");
    } finally {
      setGenerating(false);
    }
  }

  async function copyCode() {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Failed to copy");
    }
  }

  async function unlink() {
    if (!confirm("Disconnect Telegram? You can re-link anytime.")) return;
    setUnlinking(true);
    try {
      const r = await fetch("/api/account/telegram", { method: "DELETE" });
      if (!r.ok) throw new Error("unlink_failed");
      setStatus({ linked: false });
      setToken(null);
      toast.success("Telegram disconnected");
    } catch {
      toast.error("Failed to disconnect");
    } finally {
      setUnlinking(false);
    }
  }

  if (loading) {
    return (
      <section className="scroll-mt-6 space-y-3">
        <h2 className="editorial-number text-[11px]">Telegram</h2>
        <div className="text-sm text-muted-fg">Loading…</div>
      </section>
    );
  }

  return (
    <section id="settings-telegram" className="scroll-mt-6 space-y-3">
      <h2 className="editorial-number text-[11px]">Telegram</h2>
      <p className="text-xs text-muted-fg leading-relaxed">
        Connect your Telegram account to add tasks, check your schedule, and
        manage your day from{" "}
        <a
          href="https://t.me/Firstlightapp_bot"
          target="_blank"
          rel="noopener"
          className="text-accent hover:underline"
        >
          @Firstlightapp_bot
        </a>
        .
      </p>

      {status?.linked ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] items-start sm:items-center gap-2 sm:gap-4">
            <div className="text-sm text-muted-fg">Status</div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-sm text-green-600">
                <span className="size-2 rounded-full bg-green-500" />
                Connected
              </span>
              {status.telegram_username && (
                <span className="text-xs text-muted-fg">
                  @{status.telegram_username}
                </span>
              )}
            </div>
          </div>
          {status.linked_at && (
            <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] items-start sm:items-center gap-2 sm:gap-4">
              <div className="text-sm text-muted-fg">Linked</div>
              <span className="text-sm text-muted-fg">
                {formatDistanceToNow(new Date(status.linked_at), {
                  addSuffix: true,
                })}
              </span>
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <a
              href="https://t.me/Firstlightapp_bot"
              target="_blank"
              rel="noopener"
              className="btn-ghost h-8 px-3 text-xs gap-1.5 inline-flex items-center"
            >
              <MessageCircle className="size-3" />
              Open bot
            </a>
            <button
              onClick={unlink}
              disabled={unlinking}
              className="btn-ghost h-8 px-3 text-xs gap-1.5 text-danger"
            >
              <Trash2 className="size-3" />
              Disconnect
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {!token ? (
            <button
              onClick={generateCode}
              disabled={generating}
              className="btn-primary gap-2"
            >
              <MessageCircle className="size-4" />
              {generating ? "Generating code…" : "Connect Telegram"}
            </button>
          ) : (
            <div className="space-y-3">
              <div className="surface border border-border rounded-xl p-4 space-y-3">
                <p className="text-sm font-medium">
                  Send this code to{" "}
                  <a
                    href="https://t.me/Firstlightapp_bot"
                    target="_blank"
                    rel="noopener"
                    className="text-accent hover:underline"
                  >
                    @Firstlightapp_bot
                  </a>
                </p>
                <div className="flex items-center gap-3">
                  <code className="font-mono text-2xl tracking-[0.2em] font-bold select-all">
                    {token.code}
                  </code>
                  <button
                    onClick={copyCode}
                    className="btn-ghost h-8 px-3 text-xs gap-1.5 shrink-0"
                  >
                    {copied ? (
                      <Check className="size-3.5" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="text-xs text-muted-fg">
                  Code expires in 10 minutes.
                </p>
              </div>
              <div className="text-xs text-muted-fg leading-relaxed border-l-2 border-border pl-4 space-y-1">
                <p className="text-fg mb-1">How to connect:</p>
                <ol className="list-decimal pl-5 space-y-0.5">
                  <li>
                    Open{" "}
                    <a
                      href="https://t.me/Firstlightapp_bot"
                      target="_blank"
                      rel="noopener"
                      className="text-accent hover:underline"
                    >
                      @Firstlightapp_bot
                    </a>{" "}
                    in Telegram
                  </li>
                  <li>
                    Send the code above (or tap{" "}
                    <code className="bg-stone-100 px-1 rounded text-[11px]">
                      /start {token.code}
                    </code>
                    )
                  </li>
                  <li>You&apos;ll see a confirmation message when linked</li>
                </ol>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={generateCode}
                  disabled={generating}
                  className="btn-ghost h-8 px-3 text-xs gap-1.5"
                >
                  <RefreshCw
                    className={`size-3 ${generating ? "animate-spin" : ""}`}
                  />
                  New code
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
