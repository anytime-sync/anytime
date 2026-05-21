"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { Provider } from "@supabase/supabase-js";

export function OAuthButtons({ next = "/app" }: { next?: string }) {
  const [loading, setLoading] = useState<Provider | null>(null);

  async function go(provider: Provider) {
    setLoading(provider);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setLoading(null);
    if (error) toast.error(error.message);
  }

  return (
    <div className="grid grid-cols-1 gap-2">
      <button
        type="button"
        onClick={() => go("google")}
        disabled={loading !== null}
        className="btn-outline w-full gap-2"
        aria-label="Continue with Google"
      >
        <GoogleIcon />
        {loading === "google" ? "Redirecting…" : "Continue with Google"}
      </button>
      <button
        type="button"
        onClick={() => go("apple")} style={{ display: "none" }}
        disabled={loading !== null}
        className="btn-outline w-full gap-2"
        aria-label="Continue with Apple"
      >
        <AppleIcon />
        {loading === "apple" ? "Redirecting…" : "Continue with Apple"}
      </button>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 18 18" className="size-4" aria-hidden="true">
      <path d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.49h4.84a4.14 4.14 0 0 1-1.8 2.72v2.27h2.92A8.78 8.78 0 0 0 17.64 9.2z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.27c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.32A9 9 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.97 10.71A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.18.29-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3.01-2.33z" fill="#FBBC05"/>
      <path d="M9 3.58c1.32 0 2.5.45 3.44 1.35L15.02 2.34A8.97 8.97 0 0 0 9 0 9 9 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true" fill="currentColor">
      <path d="M16.365 1.43c0 1.14-.46 2.22-1.21 2.99-.81.86-2.13 1.51-3.21 1.42-.15-1.13.41-2.27 1.16-3.02.84-.84 2.21-1.45 3.26-1.39zm4.13 16.07c-.59 1.36-.88 1.97-1.64 3.17-1.06 1.67-2.55 3.74-4.4 3.76-1.65.02-2.07-1.07-4.31-1.06-2.24.01-2.71 1.08-4.36 1.06-1.85-.02-3.27-1.9-4.32-3.57-2.95-4.66-3.26-10.13-1.44-13.04 1.29-2.07 3.33-3.28 5.25-3.28 1.95 0 3.18 1.07 4.79 1.07 1.57 0 2.52-1.07 4.78-1.07 1.71 0 3.52.93 4.81 2.55-4.23 2.32-3.55 8.36.84 10.41z"/>
    </svg>
  );
}
