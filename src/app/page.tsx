"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LanguagePicker } from "@/components/app/language-picker";
import { AuthCard } from "@/components/auth/auth-card";
import { DesignSlot } from "@/lib/design/slot";
import {
  readStoredLanguage,
  t,
  type LanguageCode,
} from "@/lib/i18n";

export default function Home() {
  const [authMode, setAuthMode] = useState<"signup" | "login" | null>(null);
  const [lang, setLang] = useState<LanguageCode>("en");

  useEffect(() => {
    setLang(readStoredLanguage());
    function onStorage(e: StorageEvent) {
      if (e.key === "fl.language") setLang(readStoredLanguage());
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const principles = [
    { kicker: "01", id: "landing.principle.1", title: t(lang, "landing.principle1Title"), body: t(lang, "landing.principle1Body"), Glyph: SmallSun  },
    { kicker: "02", id: "landing.principle.2", title: t(lang, "landing.principle2Title"), body: t(lang, "landing.principle2Body"), Glyph: BeamLight },
    { kicker: "03", id: "landing.principle.3", title: t(lang, "landing.principle3Title"), body: t(lang, "landing.principle3Body"), Glyph: SunHorizon },
    { kicker: "04", id: "landing.principle.4", title: t(lang, "landing.principle4Title"), body: t(lang, "landing.principle4Body"), Glyph: SoftOrb   },
    { kicker: "05", id: "landing.principle.5", title: t(lang, "landing.principle5Title"), body: t(lang, "landing.principle5Body"), Glyph: RadialSun },
  ];

  return (
    <DesignSlot id="landing.main" as="main" className="min-h-screen flex flex-col">
      <header className="px-4 md:px-6 pt-6 md:pt-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
          <Link href="/" className="shrink-0">
            <DesignSlot id="landing.wordmark" as="span" className="wordmark text-[13px] md:text-base">
              First Light
            </DesignSlot>
          </Link>
          <nav className="flex items-center text-sm text-muted-fg">
            <LanguagePicker mode="local" onChange={setLang} />
          </nav>
        </div>
      </header>

      <DesignSlot id="landing.hero" as="section" className="flex-1 grid place-items-center px-6 py-20">
        <div className="max-w-3xl text-center space-y-6">
          <DesignSlot id="landing.hero.kicker" as="p" className="editorial-number text-xs">
            {t(lang, "landing.kicker")}
          </DesignSlot>
          <DesignSlot id="landing.hero.title" as="h1" className="font-display text-5xl md:text-7xl leading-[1.05] tracking-tight">
            {t(lang, "landing.heroLine1")}
            <br />
            <em className="font-display">{t(lang, "landing.heroLine2")}</em>
          </DesignSlot>
          <DesignSlot id="landing.hero.body" as="p" className="text-base md:text-lg text-muted-fg max-w-xl mx-auto">
            {t(lang, "landing.heroBody")}
          </DesignSlot>
          <div className="flex items-center justify-center gap-3 pt-2">
            <DesignSlot
              id="landing.hero.signupCta"
              as="button"
              type="button"
              onClick={() => setAuthMode("signup")}
              className="btn-primary px-5 h-11"
            >
              {t(lang, "landing.signupCta")}
            </DesignSlot>
            <DesignSlot
              id="landing.hero.loginCta"
              as="button"
              type="button"
              onClick={() => setAuthMode("login")}
              className="btn-outline px-5 h-11"
            >
              {t(lang, "landing.loginCta")}
            </DesignSlot>
          </div>
          <DesignSlot id="landing.hero.note" as="p" className="text-xs text-muted-fg pt-2">
            {t(lang, "landing.ctaNote")}
          </DesignSlot>
        </div>
      </DesignSlot>

      <div className="max-w-6xl w-full mx-auto px-6">
        <div className="h-px bg-border" />
      </div>

      <DesignSlot id="landing.principles" as="section" className="px-6 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <DesignSlot id="landing.principles.kicker" as="p" className="editorial-number text-xs">
              {t(lang, "landing.principlesKicker")}
            </DesignSlot>
            <DesignSlot id="landing.principles.heading" as="h2" className="font-display text-3xl md:text-4xl mt-2">
              <em>{t(lang, "landing.principlesHeading")}</em>
            </DesignSlot>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-5 gap-x-6 gap-y-12">
            {principles.map(({ kicker, id, title, body, Glyph }) => (
              <DesignSlot key={kicker} id={id} as="article" className="space-y-3 text-center">
                <Glyph className="size-16 mx-auto text-accent" />
                <div className="editorial-number text-[10px]">{kicker}</div>
                <DesignSlot id={`${id}.title`} as="h3" className="font-display text-xl leading-tight">{title}</DesignSlot>
                <DesignSlot id={`${id}.body`} as="p" className="text-sm text-muted-fg leading-relaxed">{body}</DesignSlot>
              </DesignSlot>
            ))}
          </div>
        </div>
      </DesignSlot>

      <DesignSlot id="landing.footer" as="footer" className="px-6 py-8 border-t border-border">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2 text-xs text-muted-fg">
          <DesignSlot id="landing.footer.credit" as="span">{t(lang, "landing.footerCredit")}</DesignSlot>
          <DesignSlot
            id="landing.footer.source"
            as="a"
            href="https://github.com/anytime-sync/anytime"
            className="hover:text-fg"
          >
            {t(lang, "landing.footerSource")}
          </DesignSlot>
        </div>
      </DesignSlot>

      {authMode && (
        <AuthCard initialMode={authMode} onClose={() => setAuthMode(null)} />
      )}
    </DesignSlot>
  );
}

/* ---------- Five sun glyphs ---------- */

function SmallSun({ className }: { className?: string }) {
  const rays = Array.from({ length: 12 }, (_, i) => i * 30);
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none"
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden>
      <circle cx="32" cy="32" r="6.5" />
      {rays.map((deg, i) => (
        <line key={i} x1="32" y1="18" x2="32" y2="13"
          transform={`rotate(${deg} 32 32)`} />
      ))}
    </svg>
  );
}

function BeamLight({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none"
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden>
      <defs>
        <linearGradient id="beam" x1="32" y1="0" x2="32" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0" />
          <stop offset="50%" stopColor="currentColor" stopOpacity="0.55" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="30" y="3" width="4" height="58" fill="url(#beam)" stroke="none" rx="2" />
      <circle cx="32" cy="32" r="11" />
      <circle cx="32" cy="32" r="2.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

function SunHorizon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none"
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden>
      <path d="M 18 36 a 14 14 0 0 1 28 0" />
      <line x1="10" y1="42" x2="54" y2="42" />
      <line x1="14" y1="48" x2="50" y2="48" />
      <line x1="18" y1="54" x2="46" y2="54" />
    </svg>
  );
}

function SoftOrb({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <radialGradient id="orb" cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stopColor="currentColor" stopOpacity="0.55" />
          <stop offset="60%" stopColor="currentColor" stopOpacity="0.20" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="22" fill="url(#orb)" />
      <circle cx="32" cy="32" r="14" fill="currentColor" fillOpacity="0.15" />
    </svg>
  );
}

function RadialSun({ className }: { className?: string }) {
  const rays = Array.from({ length: 16 }, (_, i) => i * 22.5);
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none"
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden>
      <circle cx="32" cy="32" r="7" />
      {rays.map((deg, i) => (
        <line key={i} x1="32" y1="20" x2="32" y2="9"
          transform={`rotate(${deg} 32 32)`} />
      ))}
    </svg>
  );
}
