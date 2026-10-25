import type { Metadata } from "next";
import { loadPrices, formatPrice } from "@/lib/pricing";
import { t } from "@/lib/i18n";

const FAQ_ITEMS = Array.from({ length: 7 });

export async function generateMetadata(): Promise<Metadata> {
  const { plusCents, proCents, currency } = await loadPrices();
  const plus = formatPrice(plusCents, currency);
  const pro = formatPrice(proCents, currency);

  return {
    title: "Pricing",
    description: "Free, Plus, and Pro plans for the calm daily productivity tool. Tasks, notes, Google Calendar sync, habits, focus, and API/MCP access.",
    alternates: { canonical: "/pricing" },
    openGraph: {
      title: "Pricing \u2014 First Light",
      description: `Start free. Plus ${plus}/mo. Pro ${pro}/mo. Calm daily productivity with tasks, calendar sync, and focus tools.`,
      url: "https://firstlight.to/pricing",
      images: ["/og.png"],
    },
    twitter: {
      card: "summary_large_image",
      title: "Pricing \u2014 First Light",
      description: `Start free. Plus ${plus}/mo. Pro ${pro}/mo. Calm daily productivity.`,
      images: ["/og.png"],
    },
  };
}

function FAQJsonLd() {
  const data = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ_ITEMS.map((_, i) => ({ "@type": "Question", name: t("en", `pricing.faq.q${i + 1}` as Parameters<typeof t>[1]), acceptedAnswer: { "@type": "Answer", text: t("en", `pricing.faq.a${i + 1}` as Parameters<typeof t>[1]) } })) };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <><FAQJsonLd />{children}</>;
}
