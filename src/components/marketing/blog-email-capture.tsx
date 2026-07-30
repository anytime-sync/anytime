"use client";

import { useState } from "react";

/**
 * BlogEmailCapture — inline bare-email capture for the blog Daily Edition
 * CTA (growth loop step 2).
 *
 * Posts to /api/auth/magic-link, which sends a passwordless Supabase magic
 * link. On success we replace the form with a calm "check your inbox"
 * confirmation — no password, no second page. A hidden honeypot field traps
 * the bots that a bare email form on a public blog page inevitably attracts.
 */
export function BlogEmailCapture() {
  const [email, setEmail] = useState("");
  const [hp, setHp] = useState(""); // honeypot — real users never fill this
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">(
    "idle"
  );
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "loading") return;
    setStatus("loading");
    setMessage("");
    try {
      const r = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, hp, ref: "blog" }),
      });
      if (r.ok) {
        setStatus("sent");
        return;
      }
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (j.error === "rate_limited") {
        setMessage("Too many attempts — give it a minute and try again.");
      } else if (j.error === "invalid_email") {
        setMessage("That email doesn’t look right — mind checking it?");
      } else {
        setMessage("Couldn’t send the link just now. Please try again.");
      }
      setStatus("error");
    } catch {
      setMessage("Network hiccup — please try again.");
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <p
        className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-fg"
        role="status"
      >
        Check your inbox — we sent a magic link to{" "}
        <span className="font-medium">{email}</span>. Click it and your first
        Daily Edition is ready, no password needed.
      </p>
    );
  }

  return (
    <div className="mx-auto mt-4 w-full max-w-md">
      <form
        onSubmit={onSubmit}
        className="flex flex-col items-stretch gap-2 sm:flex-row"
        data-cta="blog-daily-edition"
      >
        {/* Honeypot — pushed off-screen; bots fill it, humans don’t. */}
        <input
          type="text"
          name="company"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={hp}
          onChange={(e) => setHp(e.target.value)}
          className="absolute left-[-9999px] h-0 w-0 opacity-0"
        />
        <input
          type="email"
          required
          placeholder="you@example.com"
          aria-label="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input h-10 flex-1 text-sm"
        />
        <button
          type="submit"
          className="btn-primary h-10 px-5 text-sm"
          disabled={status === "loading"}
        >
          {status === "loading" ? "Sending…" : "Start your Daily Edition — free"}
        </button>
      </form>
      {status === "error" && message ? (
        <p className="mt-2 text-center text-xs text-red-500" role="alert">
          {message}
        </p>
      ) : null}
    </div>
  );
}
