"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { OAuthButtons } from "@/components/auth/oauth-buttons";

function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") ?? "/app";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    router.replace(next);
    router.refresh();
  }

  async function onMagicLink() {
    if (!email) return toast.error("Enter your email first");
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Check your inbox for a magic link");
  }

  return (
    <div className="card w-full max-w-md p-8 space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Welcome back</h1>
        <p className="text-sm text-muted-fg">Log in to your tasks.</p>
      </div>

      <OAuthButtons next={next} />

      <Divider>or with email</Divider>

      <form onSubmit={onPassword} className="space-y-3">
        <input
          type="email"
          placeholder="you@example.com"
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
        <button className="btn-primary w-full" disabled={loading}>
          {loading ? "…" : "Log in"}
        </button>
      </form>

      <button onClick={onMagicLink} className="btn-ghost w-full text-sm" disabled={loading}>
        Email me a magic link instead
      </button>

      <p className="text-sm text-center text-muted-fg">
        New here?{" "}
        <Link href="/signup" className="text-accent hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}

function Divider({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-px bg-border" />
      <span className="text-xs uppercase tracking-wider text-muted-fg">{children}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen grid place-items-center px-6">
      <Suspense fallback={<div className="text-muted-fg">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
