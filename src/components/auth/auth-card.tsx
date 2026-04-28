"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { LanguagePicker } from "@/components/app/language-picker";
import {
  readStoredLanguage,
  t,
  type LanguageCode,
} from "@/lib/i18n";

type Mode = "login" | "signup";

/**
 * Inline auth overlay used by the landing page. The wordmark stays
 * visible behind the dimmed backdrop so the user never feels they
 * jumped to a new page; this is a card, not a route.
 *
 * Tabs flip between Sign up and Log in without a navigation.
 * Language is read from localStorage so the choice on the landing
 * page carries through here.
 */
export function AuthCard({
  initialMode,
  onClose,
}: {
  initialMode: Mode;
  onClose: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [lang, setLang] = useState<LanguageCode>("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setLang(readStoredLanguage());
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/30 backdrop-blur-sm animate-fade-in px-4"
      onClick={onClose}
    >
      <div
        className="card surface-strong w-full max-w-md p-7 space-y-5 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar — language picker (left) + close (right) */}
        <div className="absolute top-3 left-3">
          <LanguagePicker mode="local" onChange={setLang} />
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t(lang, "auth.shared.close")}
          className="absolute top-3 right-3 size-8 grid place-items-center rounded-full hover:bg-muted text-muted-fg hover:text-fg transition"
        >
          <X className="size-4" />
        </button>

        {/* Tabs */}
        <div className="flex gap-1 pt-6">
          <Tab active={mode === "signup"} onClick={() => setMode("signup")}>
            {t(lang, "auth.shared.signupTab")}
          </Tab>
          <Tab active={mode === "login"} onClick={() => setMode("login")}>
            {t(lang, "auth.shared.loginTab")}
          </Tab>
        </div>

        {mode === "signup" ? (
          <SignupForm lang={lang} onLoggedIn={() => router.replace("/app")} />
        ) : (
          <LoginForm lang={lang} onLoggedIn={() => router.replace("/app")} />
        )}
      </div>
    </div>,
    document.body
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "px-4 h-9 text-sm rounded-md transition " +
        (active
          ? "bg-muted text-fg font-medium"
          : "text-muted-fg hover:bg-muted/60 hover:text-fg")
      }
    >
      {children}
    </button>
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

function LoginForm({ lang, onLoggedIn }: { lang: LanguageCode; onLoggedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  // Default ON — most users want to stay signed in. The cookie
  // middleware reads `fl.auth.persist` and either keeps the long
  // maxAge ("1") or strips it for session-only cookies ("0").
  const [stayLogged, setStayLogged] = useState(true);

  async function onPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    // Set the persist flag BEFORE signing in so the auth cookies
    // the server is about to set inherit the right maxAge.
    document.cookie = `fl.auth.persist=${stayLogged ? "1" : "0"}; path=/; max-age=${
      60 * 60 * 24 * 365
    }; SameSite=Lax`;
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) {
      try {
        const u = (await supabase.auth.getUser()).data.user;
        if (u) {
          await supabase
            .from("user_preferences")
            .update({ language: readStoredLanguage() })
            .eq("user_id", u.id);
        }
      } catch {}
    }
    setLoading(false);
    if (error) return toast.error(error.message);
    onLoggedIn();
  }

  async function onMagicLink() {
    if (!email) return toast.error("Enter your email first");
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback?next=/app` },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Check your inbox for a magic link");
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-2xl tracking-tight">
          {t(lang, "auth.login.title")}
        </h2>
        <p className="text-sm text-muted-fg">{t(lang, "auth.login.subtitle")}</p>
      </div>
      <OAuthButtons />
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
    </div>
  );
}

function SignupForm({ lang, onLoggedIn }: { lang: LanguageCode; onLoggedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name, preferred_language: readStoredLanguage() },
        emailRedirectTo: `${location.origin}/auth/callback?next=/app`,
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success(t(lang, "auth.signup.created"));
    // If email confirmation is off, the session is set immediately.
    if (data.session) onLoggedIn();
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-2xl tracking-tight">
          {t(lang, "auth.signup.title")}
        </h2>
        <p className="text-sm text-muted-fg">{t(lang, "auth.signup.subtitle")}</p>
      </div>
      <OAuthButtons />
      <Divider>{t(lang, "auth.login.orEmail")}</Divider>
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          placeholder={t(lang, "auth.signup.namePlaceholder")}
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
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
          placeholder={t(lang, "auth.signup.passwordPlaceholder")}
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
        />
        <button className="btn-primary w-full" disabled={loading}>
          {loading ? "…" : t(lang, "auth.signup.submit")}
        </button>
      </form>
    </div>
  );
}
