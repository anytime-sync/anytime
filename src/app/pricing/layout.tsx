import type { Metadata } from "next";

const FAQ_ITEMS = [
  {
    question: "Can I cancel anytime?",
    answer:
      "Yes. Use the customer portal in Settings → Billing. Your subscription stays active until the end of the period you've already paid for.",
  },
  {
    question: "What happens to my data if I downgrade?",
    answer:
      "Your data is yours. Tasks, notes, and calendar links keep working on Free; only the Pro-only AI features stop running.",
  },
  {
    question: "Is there a team plan?",
    answer:
      "Not yet. We're focused on making the single-player experience excellent first.",
  },
  {
    question: "What languages does First Light support?",
    answer:
      "English, Traditional Chinese (繁體中文), Simplified Chinese (简体中文), Japanese (日本語), and Korean (한국어) — with native typography tuned for each language.",
  },
  {
    question: "Does First Light work on mobile?",
    answer:
      "Yes. First Light is a progressive web app (PWA) that works beautifully on any device — phone, tablet, or desktop. Install it from your browser for an app-like experience.",
  },
  {
    question: "How does the AI Daily Edition work?",
    answer:
      "Every morning, First Light reads your calendar, tasks, and deadlines, then writes you a short editorial briefing — like a personal newspaper for your day. Free gets 1 per day; Plus and Pro get unlimited.",
  },
  {
    question: "Is my data secure?",
    answer:
      "Yes. First Light uses Supabase (built on PostgreSQL) with row-level security. Your data is encrypted in transit and at rest. We never sell your data or use it for advertising.",
  },
];

export const metadata: Metadata = {
  title: "Pricing — First Light",
  description:
    "Free, Plus, and Pro plans for the calm daily productivity tool. Daily brief, AI plan-my-day, voice/snapshot/paste to task, Google Calendar sync, weekly review.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Pricing — First Light",
    description:
      "Free forever. Plus $3/mo. Pro $9/mo. Calm daily productivity with AI briefings, calendar sync, and focus tools.",
    url: "https://firstlight.to/pricing",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing — First Light",
    description:
      "Free forever. Plus $3/mo. Pro $9/mo. Calm daily productivity.",
    images: ["/og.png"],
  },
};

function FAQJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <FAQJsonLd />
      {children}
    </>
  );
}
