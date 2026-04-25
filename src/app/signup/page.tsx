"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { OAuthButtons } from "@/components/auth/oauth-buttons";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: `${location.origin}/auth/callback?next=/app`,
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account created. Check your inbox to verify.");
    router.replace("/login");
  }

  return (
    <main className="min-h-screen grid place-items-center px-6">
      <div className="card w-full max-w-md p-8 space-y-5">
        <div>
          <h1 className="text-2xl font-semibold">Create your account</h1>
          <p className="text-sm text-muted-fg">It&apos;s free. No credit card.</p>
        </div>

        <OAuthButtons />

        <Divider>or with email</Divider>

        <form onSubmit={onSubmit} className="space-y-3">
          <input
            placeholder="Your name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
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
            placeholder="Password (min 6 chars)"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? "…" : "Sign up"}
          </button>
        </form>

        <p className="text-sm text-center text-muted-fg">
          Already have an account?{" "}
          <Link href="/login" className="text-accent hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
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
