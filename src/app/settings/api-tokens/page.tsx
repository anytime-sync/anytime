"use client";

/**
 * Settings → API tokens
 *
 * Lists existing PATs, lets the user mint a new one (raw token shown
 * exactly once), and revoke any token. Gated to plans where
 * `apiAccess` is true (Pro / VIP).
 */

import { useEffect, useState } from "react";
import { useCanUseFeature } from "@/hooks/use-feature";

interface TokenRow {
  id: string;
  name: string;
  token_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export default function ApiTokensPage() {
  const canUse = useCanUseFeature("apiAccess");
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [justMinted, setJustMinted] = useState<{ token: string; name: string } | null>(
    null,
  );

  async function refresh() {
    setLoading(true);
    const r = await fetch("/api/internal/api-tokens");
    if (r.ok) setTokens((await r.json()).tokens);
    setLoading(false);
  }
  useEffect(() => {
    if (canUse) void refresh();
  }, [canUse]);

  async function mint() {
    if (!newName.trim()) return;
    setCreating(true);
    const r = await fetch("/api/internal/api-tokens", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    setCreating(false);
    if (!r.ok) {
      alert("Could not mint token.");
      return;
    }
    const { raw_token } = await r.json();
    setJustMinted({ token: raw_token, name: newName.trim() });
    setNewName("");
    void refresh();
  }

  async function revoke(id: string) {
    if (!confirm("Revoke this token? Any client using it will stop working.")) return;
    await fetch(`/api/internal/api-tokens/${id}`, { method: "DELETE" });
    void refresh();
  }

  if (!canUse) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <h1 className="text-2xl font-serif">API tokens</h1>
        <p className="mt-3 text-stone-600">
          Public API & MCP access is a Pro-tier feature. Upgrade to issue tokens
          and connect First Light to Claude, Claude Code, or any MCP-aware
          assistant.
        </p>
        <a
          href="/pricing"
          className="mt-6 inline-block rounded bg-stone-900 px-4 py-2 text-white"
        >
          See Pro plans →
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-8">
      <header>
        <h1 className="text-2xl font-serif">API tokens</h1>
        <p className="mt-2 text-stone-600">
          Personal access tokens for the First Light public API at{" "}
          <code>firstlight.to/api/v1/*</code>. Use these to connect Claude,
          Claude Code, OpenClaw, or any MCP-aware assistant.
        </p>
      </header>

      {justMinted && (
        <div className="rounded border border-amber-500 bg-amber-50 p-4">
          <div className="font-medium">Token created — copy it now.</div>
          <p className="mt-1 text-sm text-stone-700">
            “{justMinted.name}” will only show this secret once. Store it in
            your assistant&apos;s config (e.g.{" "}
            <code>FIRSTLIGHT_API_KEY</code>) before closing this dialog.
          </p>
          <pre className="mt-3 overflow-x-auto rounded bg-stone-900 p-3 text-sm text-amber-200">
            {justMinted.token}
          </pre>
          <button
            onClick={() => navigator.clipboard.writeText(justMinted.token)}
            className="mt-3 rounded bg-stone-900 px-3 py-1 text-sm text-white"
          >
            Copy
          </button>
          <button
            onClick={() => setJustMinted(null)}
            className="mt-3 ml-2 text-sm text-stone-600 underline"
          >
            I&apos;ve saved it
          </button>
        </div>
      )}

      <section className="rounded border border-stone-200 p-4">
        <h2 className="font-medium">Mint a new token</h2>
        <div className="mt-3 flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. OpenClaw on MacBook"
            className="flex-1 rounded border border-stone-300 px-3 py-2"
          />
          <button
            onClick={mint}
            disabled={creating || !newName.trim()}
            className="rounded bg-stone-900 px-4 py-2 text-white disabled:opacity-50"
          >
            {creating ? "Minting…" : "Mint"}
          </button>
        </div>
      </section>

      <section>
        <h2 className="font-medium">Your tokens</h2>
        {loading ? (
          <p className="mt-2 text-stone-500">Loading…</p>
        ) : tokens.length === 0 ? (
          <p className="mt-2 text-stone-500">No tokens yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-stone-200 rounded border border-stone-200">
            {tokens.map((t) => (
              <li key={t.id} className="flex items-center gap-3 p-3">
                <div className="flex-1">
                  <div className="font-medium">{t.name}</div>
                  <div className="text-sm text-stone-500">
                    <code>{t.token_prefix}…</code> · scopes {t.scopes.join(", ")} ·
                    last used {t.last_used_at ?? "never"}
                  </div>
                </div>
                {t.revoked_at ? (
                  <span className="text-sm text-stone-400">revoked</span>
                ) : (
                  <button
                    onClick={() => revoke(t.id)}
                    className="text-sm text-red-700 underline"
                  >
                    Revoke
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

