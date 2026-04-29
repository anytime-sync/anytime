"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { LanguagePicker } from "@/components/app/language-picker";
import { FloatingLayer } from "@/lib/design/floating-layer";
import { readStoredLanguage, t, type LanguageCode } from "@/lib/i18n";

function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") ?? "/app";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [stayLogged, setStayLogged] = useState(true);
  const [lang, setLang] = useState<LanguageCode>("en");
  useEffect(() => setLang(readStoredLanguage()), []);

  async function onPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    // "Stay signed in" → 30-day cookie maxAge; unchecked → session-only.
    document.cookie = `fl.auth.persist=${stayLogged ? "1" : "0"}; path=/; max-age=${
      60 * 60 * 24 * 365
    }; SameSite=Lax`;
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) {
      // Push pre-login language choice into user_preferences after sign-in.
      try {
        const stored = readStoredLanguage();
        await supabase
          .from("user_preferences")
          .update({ language: stored })
          .eq("user_id", (await supabase.auth.getUser()).data.user?.id ?? "");
      } catch {}
    }
    setLoading(false);
    if (error) return toast.error(error.message);
    // Hard navigation so the just-set Supabase auth cookies are
    // committed before the next request — soft router.replace fires
    // while the cookie jar is still settling and the middleware
    // bounces the user back to /login (the "double login" bug).
    window.location.replace(next);
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
    <div className="card w-full max-w-md p-8 space-y-5 relative">
      <div className="absolute top-3 right-3">
        <LanguagePicker mode="local" onChange={setLang} />
      </div>
      <div>
        <h1 className="font-display text-2xl tracking-tight">{t(lang, "auth.login.title")}</h1>
        <p className="text-sm text-muted-fg">{t(lang, "auth.login.subtitle")}</p>
      </div>

      <OAuthButtons next={next} />

      <Divider>{t(lang, "auth.login.orEmail")}</Divider>

      <form onSubmit={onPassword} className="space-y-3">
        <input
          type="email"
          placeholder={t(lang, "auth.login.emailPlaceholder")}
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder={t(lang, "auth.login.passwordPlaceholder")}
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
        <label className="flex items-center gap-2 text-xs text-muted-fg cursor-pointer select-none">
          <input
            type="checkbox"
            checked={stayLogged}
            onChange={(e) => setStayLogged(e.target.checked)}
            className="size-3.5 accent-accent cursor-pointer"
          />
          Stay signed in for 30 days
        </label>
        <button className="btn-primary w-full" disabled={loading}>
          {loading ? "…" : t(lang, "auth.login.submit")}
        </button>
      </form>

      <button onClick={onMagicLink} className="btn-ghost w-full text-sm" disabled={loading}>
        {t(lang, "auth.login.magic")}
      </button>

      <p className="text-sm text-center text-muted-fg">
        {t(lang, "auth.login.newHere")}{" "}
        <Link href="/signup" className="text-accent hover:underline">
          {t(lang, "auth.login.createAccount")}
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
    <main className="min-h-screen grid place-items-center px-6 relative">
      <Suspense fallback={<div className="text-muted-fg">Loading…</div>}>
        <LoginForm />
      </Suspense>
      <FloatingLayer page="/login" />
    </main>
  );
}
