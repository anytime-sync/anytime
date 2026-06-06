/**
 * Round Z5: editable landing-page content.
 *
 * Defaults live in code. Admin can override via /app/admin/design.
 * Pages render with config ?? fallback so they always work.
 */

export type LandingConfig = {
  pricing?: {
    hero?: { title?: string; subtitle?: string; eyebrow?: string };
    free?: { tagline?: string; features?: string[] };
    pro?: { tagline?: string; features?: string[]; badge?: string };
    demos?: Array<{ title: string; subtitle?: string; asset: string }>;
    faq?: Array<{ q: string; a: string }>;
    finalCta?: { helper?: string };
  };
  features?: {
    headerSubtitle?: string;
    unlockTitle?: string;
  };
};

/**
 * Same shape as LandingConfig but every leaf is concrete. Used as the type
 * of DEFAULT_LANDING_CONFIG and as the return of withDefaults() so consumers
 * never need to deal with `| undefined` on nested fields.
 */
export type LandingConfigResolved = {
  pricing: {
    hero: { title: string; subtitle: string; eyebrow: string };
    free: { tagline: string; features: string[] };
    pro: { tagline: string; features: string[]; badge: string };
    demos: Array<{ title: string; subtitle?: string; asset: string }>;
    faq: Array<{ q: string; a: string }>;
    finalCta: { helper: string };
  };
  features: {
    headerSubtitle: string;
    unlockTitle: string;
  };
};

export const DEFAULT_LANDING_CONFIG: LandingConfigResolved = {
  pricing: {
    hero: {
      eyebrow: "PRICING",
      title: "Built for the way you actually plan.",
      subtitle:
        "Free covers the full task system, indefinitely. Pro adds the AI co-pilot and two-way calendar — for people who want a daily edition instead of a to-do list.",
    },
    free: {
      tagline: "The full task system, forever.",
      features: [
        "Today, Tomorrow, Next 7 / 90 days, Inbox",
        "Calendar with Google Calendar (read)",
        "Lists, Tags, Groups, Habits, Notes, Focus Timer",
        "Notes ↔ Task: convert either way",
        "Daily Edition (1 / day)",
        "Email-to-inbox, push, daily digest",
        "Export your data, anytime",
      ],
    },
    pro: {
      badge: "Recommended",
      tagline: "Add the AI co-pilot and two-way calendar.",
      features: [
        "Everything in Free",
        "Unlimited Daily Edition",
        "Plan-my-day & Plan-my-week",
        "Morning Co-pilot (conversational briefing)",
        "Voice → Task & Snapshot → Task",
        "Smart triage & AI Goal tracker",
        "Reflection & Weekly review",
        "Two-way Google Calendar sync",
        "Semantic search across tasks & notes",
        "Priority support",
      ],
    },
    demos: [
      { title: "Daily Edition",  subtitle: "Your morning briefing",        asset: "/screenshots/daily-edition.png" },
      { title: "Plan my day",    subtitle: "Energy-aware sequencing",      asset: "/screenshots/plan-my-day.png" },
      { title: "Calendar",       subtitle: "Tasks + events together",      asset: "/screenshots/calendar.png" },
      { title: "Voice → Task",   subtitle: "Speak; we transcribe",         asset: "/screenshots/voice-capture.png" },
      { title: "Snapshot → Task",subtitle: "Photo a sticky; we extract",   asset: "/screenshots/snapshot.png" },
      { title: "Reflection",     subtitle: "End-of-day with prompts",      asset: "/screenshots/reflection.png" },
    ],
    faq: [
      { q: "Can I cancel anytime?", a: "Yes. Use the customer portal in Settings → Billing. Your subscription stays active until the end of the period you've already paid for." },
      { q: "What happens to my data if I downgrade?", a: "Your data is yours. Tasks, notes, and calendar links keep working on Free; only the Pro-only AI features stop running." },
      { q: "Is there a team plan?", a: "Not yet. We're focused on making the single-player experience excellent first." },
    ],
    finalCta: {
      helper: "Free forever for the core task system. Cancel Pro anytime.",
    },
  },
  features: {
    headerSubtitle: "What's available on each plan, and what you have access to right now.",
    unlockTitle: "What you unlock",
  },
};

/**
 * Merge config from DB on top of defaults. Each leaf is replaced atomically;
 * arrays replace whole, scalars replace, missing keys fall through.
 */
export function withDefaults(c: LandingConfig | null | undefined): LandingConfigResolved {
  const cfg = c ?? {};
  const d = DEFAULT_LANDING_CONFIG;
  return {
    pricing: {
      hero: { ...d.pricing.hero, ...(cfg.pricing?.hero ?? {}) },
      free: {
        ...d.pricing.free,
        ...(cfg.pricing?.free ?? {}),
        features: cfg.pricing?.free?.features ?? d.pricing.free.features,
      },
      pro: {
        ...d.pricing.pro,
        ...(cfg.pricing?.pro ?? {}),
        features: cfg.pricing?.pro?.features ?? d.pricing.pro.features,
      },
      demos: cfg.pricing?.demos ?? d.pricing.demos,
      faq: cfg.pricing?.faq ?? d.pricing.faq,
      finalCta: { ...d.pricing.finalCta, ...(cfg.pricing?.finalCta ?? {}) },
    },
    features: { ...d.features, ...(cfg.features ?? {}) },
  };
}
