"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { LanguagePicker } from "@/components/app/language-picker";
import { readStoredLanguage, t, type LanguageCode } from "@/lib/i18n";

export default function SignupPage() {
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
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
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
    router.replace("/login");
  }

  return (
    <main className="min-h-screen grid place-items-center px-6">
      <div className="card w-full max-w-md p-8 space-y-5 relative">
        <div className="absolute top-3 right-3">
          <LanguagePicker mode="local" onChange={setLang} />
        </div>
        <div>
          <h1 className="font-display text-2xl tracking-tight">{t(lang, "auth.signup.title")}</h1>
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

        <p className="text-sm text-center text-muted-fg">
          {t(lang, "auth.signup.haveAccount")}{" "}
          <Link href="/login" className="text-accent hover:underline">
            {t(lang, "auth.signup.login")}
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
