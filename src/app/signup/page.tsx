"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { authDestination } from "@/lib/auth-destination";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { authCopy } from "@/lib/auth-copy";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { LanguagePicker } from "@/components/app/language-picker";
import { FloatingLayer } from "@/lib/design/floating-layer";
import { readStoredLanguage, t, type LanguageCode } from "@/lib/i18n";
import { isPasswordBreached, validatePasswordStrength } from "@/lib/password-security";

function SignupFormPage() {
  const params = useSearchParams();
  const next = authDestination(params.get("next"));
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState<LanguageCode>("en");
  useEffect(() => setLang(readStoredLanguage()), []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    // Default to "Stay signed in" for new accounts — most users want
    // their browser to remember them after signup. The browser client
    // and middleware both read `fl.auth.persist` and stamp 30-day
    // Max-Age on the auth cookies when it's "1" (or absent).
    document.cookie = `fl.auth.persist=1; path=/; max-age=${
      60 * 60 * 24 * 365
    }; SameSite=Lax`;
    // Password security (replaces the Pro-tier "Prevent use of leaked
    // passwords" Supabase toggle on free tier). Local strength check first,
    // then a HaveIBeenPwned k-anonymity lookup.
    const strength = validatePasswordStrength(password);
    if (!strength.ok) {
      setLoading(false);
      return toast.error(strength.reason);
    }
    const breached = await isPasswordBreached(password);
    if (breached) {
      setLoading(false);
      return toast.error("This password has appeared in a known data breach. Please choose another.");
    }
    const supabase = createClient();
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name, preferred_language: readStoredLanguage() },
        emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success(t(lang, "auth.signup.created"));
    // If email confirmation is OFF in Supabase, signUp returns a live
    // session — drop the user straight into the app instead of forcing
    // them through /login a second time. Hard navigation so the just-
    // set auth cookies are committed before middleware runs.
    if (data.session) {
      window.location.replace(next);
    } else {
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center px-6 py-12 relative">
      <FloatingLayer page="/signup" />
      <div className="w-full max-w-md space-y-4">
        {/*
          Operator identity above the credential form. Added after the
          July 2026 Google Safe Browsing "deceptive pages" flag: a sign-up
          form on a domain with no visible owner reads as phishing. Do not
          remove the wordmark link, the operator line, or the legal links
          at the bottom of this page.
        */}
        <Link
          href="/"
          className="wordmark text-lg flex items-center justify-center gap-2 text-fg"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-black.png" alt="" className="size-7 block dark:hidden" aria-hidden="true" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-white.png" alt="" className="size-7 hidden dark:block" aria-hidden="true" />
          First Light
        </Link>

        <div className="card w-full p-8 space-y-5 relative">
          <div className="absolute top-3 right-3">
            <LanguagePicker mode="local" onChange={setLang} />
          </div>
          <div>
            <h1 className="font-display text-2xl tracking-tight">{t(lang, "auth.signup.title")}</h1>
            <p className="text-sm text-muted-fg">{t(lang, "auth.signup.subtitle")}</p>
          </div>

          <OAuthButtons next={next} />

          <p className="text-xs text-muted-fg leading-relaxed">
{authCopy(lang).disclosure}
          </p>

          <Divider>{t(lang, "auth.login.orEmail")}</Divider>

          <form onSubmit={onSubmit} className="space-y-3">
            <input
              placeholder={t(lang, "auth.signup.namePlaceholder")}
              aria-label={t(lang, "auth.signup.namePlaceholder")}
              autoComplete="name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              type="email"
              placeholder={t(lang, "auth.login.emailPlaceholder")}
              aria-label={t(lang, "auth.login.emailPlaceholder")}
              autoComplete="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder={t(lang, "auth.signup.passwordPlaceholder")}
              aria-label={t(lang, "auth.signup.passwordPlaceholder")}
              autoComplete="new-password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={10}
              required
            />
            <p className="text-xs text-muted-fg">{t(lang, "auth.signup.passwordPlaceholder")}</p>
            <button className="btn-primary w-full" disabled={loading}>
              {loading ? "…" : t(lang, "auth.signup.submit")}
            </button>
          </form>

          <p className="text-sm text-center text-muted-fg">
            {t(lang, "auth.signup.haveAccount")}{" "}
            <Link href={`/login?next=${encodeURIComponent(next)}`} className="text-accent hover:underline">
              {t(lang, "auth.signup.login")}
            </Link>
          </p>
        </div>

        <div className="text-center text-xs text-muted-fg space-y-2">
          <p>
            {authCopy(lang).termsIntro}{" "}
            <Link href="/terms" className="underline hover:text-fg">
              {authCopy(lang).terms}
            </Link>{" "}
            {authCopy(lang).and}{" "}
            <Link href="/privacy" className="underline hover:text-fg">
              {authCopy(lang).privacy}
            </Link>
            .
          </p>
          <p>
            First Light is an independent product operated by Yulin Cheng in Taipei,
            Taiwan.{" "}
            <Link href="/about" className="underline hover:text-fg">
              About
            </Link>{" "}
            &middot;{" "}
            <Link href="/contact" className="underline hover:text-fg">
              Contact
            </Link>
          </p>
        </div>
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

export default function SignupPage() {
  return <Suspense><SignupFormPage /></Suspense>;
}
