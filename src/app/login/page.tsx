"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

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
      options: { emailRedirectTo: `${location.origin}/auth/callback?next=${next}` },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Check your inbox for a magic link");
  }

  return (
    <div className="card w-full max-w-md p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Welcome back</h1>
        <p className="text-sm text-muted-fg">Log in to your tasks.</p>
      </div>
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
      <div className="text-center text-sm text-muted-fg">or</div>
      <button onClick={onMagicLink} className="btn-outline w-full" disabled={loading}>
        Email me a magic link
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

export default function LoginPage() {
  return (
    <main className="min-h-screen grid place-items-center px-6">
      <Suspense fallback={<div className="t