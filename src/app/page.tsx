"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LanguagePicker } from "@/components/app/language-picker";
import { DemoCarousel } from "@/components/marketing/demo-carousel";
import { AuthCard } from "@/components/auth/auth-card";
import { DesignSlot } from "@/lib/design/slot";
import { FloatingLayer } from "@/lib/design/floating-layer";
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
    { kicker: "01", id: "landing.principle.1", titleKey: "landing.principle1Title", bodyKey: "landing.principle1Body", Glyph: SmallSun  },
    { kicker: "02", id: "landing.principle.2", titleKey: "landing.principle2Title", bodyKey: "landing.principle2Body", Glyph: BeamLight },
    { kicker: "03", id: "landing.principle.3", titleKey: "landing.principle3Title", bodyKey: "landing.principle3Body", Glyph: SunHorizon },
    { kicker: "04", id: "landing.principle.4", titleKey: "landing.principle4Title", bodyKey: "landing.principle4Body", Glyph: SoftOrb   },
    { kicker: "05", id: "landing.principle.5", titleKey: "landing.principle5Title", bodyKey: "landing.principle5Body", Glyph: RadialSun },
  ] as const;

  return (
    <DesignSlot id="landing.main" as="main" className="min-h-screen flex flex-col"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: '[{"@context":"https://schema.org","@type":"SoftwareApplication","name":"First Light","applicationCategory":"ProductivityApplication","operatingSystem":"Web","description":"A calm daily productivity tool. Read once in the morning; the day is shaped.","url":"https://firstlight.to","offers":[{"@type":"Offer","name":"Free","price":"0","priceCurrency":"USD"},{"@type":"Offer","name":"Plus","price":"4","priceCurrency":"USD"},{"@type":"Offer","name":"Pro","price":"9","priceCurrency":"USD"}]},{"@context":"https://schema.org","@type":"Organization","name":"First Light","url":"https://firstlight.to","logo":"https://firstlight.to/icons/icon.svg"}]' }} />
      <header className="px-4 md:px-6 pt-6 md:pt-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
          <Link href="/" className="shrink-0">
            <DesignSlot id="landing.wordmark" as="span" className="wordmark text-[13px] md:text-base">
              First Light
            </DesignSlot>
          </Link>
          <nav className="flex items-center gap-4 text-sm text-muted-fg">
            <Link
              href="/pricing"
              className="hover:text-fg transition-colors hidden sm:inline"
            >
              Pricing
            </Link>
            <Link
              href="/blog"
              className="hover:text-fg transition-colors hidden sm:inline"
            >
              Blog
            </Link>
            <LanguagePicker mode="local" onChange={setLang} />
          </nav>
        </div>
      </header>

      <DesignSlot id="landing.hero" as="section" className="flex-1 grid place-items-center px-6 py-20">
        <div className="max-w-3xl text-center space-y-6">
          <DesignSlot id="landing.hero.kicker" as="p" textKey="landing.kicker" className="editorial-number text-xs">
            {t(lang, "landing.kicker")}
          </DesignSlot>
          <h1 className="font-display text-5xl md:text-7xl leading-[1.05] tracking-tight">
            <DesignSlot id="landing.hero.title.line1" as="span" textKey="landing.heroLine1">
              {t(lang, "landing.heroLine1")}
            </DesignSlot>
            <br />
            <DesignSlot id="landing.hero.title.line2" as="span" textKey="landing.heroLine2" className="italic font-display">
              {t(lang, "landing.heroLine2")}
            </DesignSlot>
          </h1>
          <DesignSlot id="landing.hero.body" as="p" textKey="landing.heroBody" className="text-base md:text-lg text-muted-fg max-w-xl mx-auto">
            {t(lang, "landing.heroBody")}
          </DesignSlot>
          <div className="flex items-center justify-center gap-3 pt-2">
            <DesignSlot
              id="landing.hero.signupCta"
              as="button"
              textKey="landing.signupCta"
              type="button"
              onClick={() => setAuthMode("signup")}
              className="btn-primary px-5 h-11"
            >
              {t(lang, "landing.signupCta")}
            </DesignSlot>
            <DesignSlot
              id="landing.hero.loginCta"
              as="button"
              textKey="landing.loginCta"
              type="button"
              onClick={() => setAuthMode("login")}
              className="btn-outline px-5 h-11"
            >
              {t(lang, "landing.loginCta")}
            </DesignSlot>
          </div>
          <DesignSlot id="landing.hero.note" as="p" textKey="landing.ctaNote" className="text-xs text-muted-fg pt-2">
            {t(lang, "landing.ctaNote")}
          </DesignSlot>
        </div>
      </DesignSlot>

      <div className="max-w-6xl w-full mx-auto px-6">
        <div className="h-px bg-border" />
      </div>

      <section className="px-6 py-16 max-w-6xl mx-auto w-full">
        <div className="text-center mb-8">
          <p className="editorial-number text-xs mb-3">SEE IT IN MOTION</p>
          <h2 className="font-display text-3xl md:text-4xl tracking-tight">
            Sixteen surfaces, one calm rhythm.
          </h2>
        </div>
        <DemoCarousel />
      </section>

      <div className="max-w-6xl w-full mx-auto px-6">
        <div className="h-px bg-border" />
      </div>

      <DesignSlot id="landing.principles" as="section" className="px-6 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <DesignSlot id="landing.principles.kicker" as="p" textKey="landing.principlesKicker" className="editorial-number text-xs">
              {t(lang, "landing.principlesKicker")}
            </DesignSlot>
            <h2 className="font-display text-3xl md:text-4xl mt-2">
              <DesignSlot id="landing.principles.heading" as="em" textKey="landing.principlesHeading">
                {t(lang, "landing.principlesHeading")}
              </DesignSlot>
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-5 gap-x-6 gap-y-12">
            {principles.map(({ kicker, id, titleKey, bodyKey, Glyph }) => (
              <DesignSlot key={kicker} id={id} as="article" className="space-y-3 text-center">
                <Glyph className="size-16 mx-auto text-accent" />
                <div className="editorial-number text-[10px]">{kicker}</div>
                <DesignSlot id={`${id}.title`} as="h3" textKey={titleKey} className="font-display text-xl leading-tight">{t(lang, titleKey)}</DesignSlot>
                <DesignSlot id={`${id}.body`} as="p" textKey={bodyKey} className="text-sm text-muted-fg leading-relaxed">{t(lang, bodyKey)}</DesignSlot>
              </DesignSlot>
            ))}
          </div>
        </div>
      </DesignSlot>


      {/* ── FAQ ── */}
      <section className="px-6 py-16 max-w-2xl mx-auto w-full">
        <h2 className="font-display text-2xl md:text-3xl tracking-tight text-center mb-10">
          Questions
        </h2>
        <div className="space-y-6">
          {[
            {
              q: "What is the Daily Edition?",
              a: "Every morning, First Light writes you a personal briefing about your day. It looks at your tasks, calendar, and patterns, then composes a short editorial — not bullet points, but a readable narrative that helps you see what matters."
            },
            {
              q: "Is First Light a task manager?",
              a: "It has tasks, calendar sync, habits, and focus modes — the essentials. But the core experience is the Daily Edition: an AI-written morning briefing that reads like a newspaper column about your day."
            },
            {
              q: "Which languages are supported?",
              a: "English, Traditional Chinese (繁體中文), Simplified Chinese (简体中文), Japanese (日本語), and Korean (한국어) — with native typography for each."
            },
            {
              q: "Is it free?",
              a: "The core planner is free forever. The AI features — Daily Edition, smart planning, weekly retrospectives — are available with Plus ($3/mo) and Pro ($9/mo). Both include a 14-day free trial."
            },
            {
              q: "Does it sync with Google Calendar?",
              a: "Yes. Your Google Calendar events appear alongside your tasks, so the Daily Edition can plan around your meetings."
            },
            {
              q: "Can I use it on my phone?",
              a: "First Light is a PWA (Progressive Web App). Add it to your home screen on iOS or Android and it works like a native app — with offline support and push notifications."
            },
          ].map(({ q, a }) => (
            <details key={q} className="group border-b border-border pb-4">
              <summary className="cursor-pointer font-medium text-sm flex items-center justify-between">
                {q}
                <span className="text-muted-fg transition-transform group-open:rotate-45 text-lg ml-2">+</span>
              </summary>
              <p className="mt-3 text-sm text-muted-fg leading-relaxed">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <DesignSlot id="landing.footer" as="footer" className="px-6 py-8 border-t border-border">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2 text-xs text-muted-fg">
          <DesignSlot id="landing.footer.credit" as="span" textKey="landing.footerCredit">{t(lang, "landing.footerCredit")}</DesignSlot>
        </div>
      </DesignSlot>

      <FloatingLayer page="/" />

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
