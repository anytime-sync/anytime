"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AdminMembersSection } from "@/components/app/admin-members-section";

/**
 * /app/admin/members
 *
 * Member admin page inside the app shell. Lists every user with their
 * effective plan (manual override > Stripe > free) and lets admins set or
 * remove a manual override. The /api/admin/users routes are admin-gated;
 * this page does a permission probe and shows a friendly message for
 * non-admins.
 */
export default function AdminMembersPage() {
  const [authState, setAuthState] = useState<"loading" | "out" | "denied" | "ok">("loading");
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const sb = createClient();
    sb.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        setAuthState("out");
        return;
      }
      setEmail(data.user.email ?? null);
      const r = await fetch("/api/admin/users?limit=1");
      if (r.status === 403) setAuthState("denied");
      else if (r.status === 401) setAuthState("out");
      else setAuthState("ok");
    });
  }, []);

  if (authState === "loading") {
    return <div className="p-8 text-sm text-muted-fg">Checking access…</div>;
  }
  if (authState === "out") {
    return (
      <div className="p-8 max-w-md">
        <h1 className="font-display text-2xl mb-2">Sign in required</h1>
        <Link href="/login" className="btn-primary h-9 px-3">
          Sign in
        </Link>
      </div>
    );
  }
  if (authState === "denied") {
    return (
      <div className="p-8 max-w-md">
        <h1 className="font-display text-2xl mb-2">Not authorized</h1>
        <p className="text-sm text-muted-fg mb-4">
          You're signed in as <span className="font-mono">{email}</span>, but this
          email isn't in the <code>ADMIN_EMAILS</code> allowlist. Add it on Vercel
          and redeploy.
        </p>
        <Link href="/app/today" className="btn-ghost h-9 px-3">
          Back to app
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 md:px-6 h-24 md:h-28 border-b border-border flex flex-col justify-center">
        <p className="editorial-number text-[11px]">ADMIN</p>
        <h1 className="font-display text-3xl md:text-4xl tracking-tight leading-tight">
          Members
        </h1>
        <p className="text-sm text-muted-fg mt-1">
          See who's signed up. Override a user's plan independent of Stripe.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
        <div className="max-w-5xl space-y-8">
          <AdminMembersSection />

          <section className="border-t border-border pt-6 text-sm text-muted-fg flex items-center gap-4">
            <Link
              href="/app/admin"
              className="text-accent hover:underline inline-flex items-center gap-1"
            >
              ← Feature flag overrides
            </Link>
            <Link
              href="/app/today"
              className="hover:text-fg inline-flex items-center gap-1"
            >
              Back to app
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
