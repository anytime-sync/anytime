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
    plus?: { tagline?: string; features?: string[] };
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
    plus: { tagline: string; features: string[] };
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
    hero: { eyebrow: "PRICING", title: "Built for the way you actually plan.", subtitle: "Start with the free planner. Plus adds two-way Google Calendar. Pro adds API/MCP access and priority support." },
    free: { tagline: "The core task planner, free to use.", features: ["Tasks, lists and tags", "Notes, habits and focus", "Google Calendar (read)", "Email-to-inbox and reminders", "Data export"] },
    plus: { tagline: "Two-way Google Calendar sync.", features: ["Everything in Free", "Two-way Google Calendar sync"] },
    pro: { badge: "Pro", tagline: "Connect your tools and get priority support.", features: ["Everything in Plus", "API/MCP access", "Priority support"] },
    demos: [],
    faq: [
      { q: "Can I cancel anytime?", a: "Use Settings → Billing to manage your subscription." },
      { q: "What happens if I downgrade?", a: "Saved tasks and notes remain. Features above your new plan are no longer available." },
      { q: "Is there a team plan?", a: "Not currently." }
    ],
    finalCta: { helper: "Start free. No credit card needed." }
  },
  features: { headerSubtitle: "Current features and plan access.", unlockTitle: "What you unlock" }
};

/** Old stored promotional arrays described retired capabilities. They cannot restore the offer. */
export function withDefaults(_c: LandingConfig | null | undefined): LandingConfigResolved {
  return DEFAULT_LANDING_CONFIG;
}
