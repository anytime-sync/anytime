/**
 * JSON-LD structured data for SEO.
 * Renders in <head> via Next.js metadata API or as a <script> tag.
 */

export function SoftwareApplicationJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "First Light",
    description:
      "The AI-native daily planner with MCP integration, Telegram bot, AI morning briefings, Google Calendar sync, habits, focus timer, and Eisenhower matrix — in 5 languages.",
    url: "https://firstlight.to",
    applicationCategory: "ProductivityApplication",
    operatingSystem: "Web",
    offers: [
      {
        "@type": "Offer",
        name: "Free",
        price: "0",
        priceCurrency: "USD",
      },
      {
        "@type": "Offer",
        name: "Plus",
        price: "3.00",
        priceCurrency: "USD",
        priceValidUntil: "2027-12-31",
      },
      {
        "@type": "Offer",
        name: "Pro",
        price: "9.00",
        priceCurrency: "USD",
        priceValidUntil: "2027-12-31",
      },
    ],
    author: {
      "@type": "Person",
      name: "Aaron Cheng",
      url: "https://firstlight.to",
    },
    inLanguage: ["en", "zh-TW", "zh-CN", "ja", "ko"],
    featureList: [
      "MCP integration for AI assistants",
      "Telegram bot",
      "AI morning briefings (Daily Edition)",
      "Google Calendar sync",
      "Eisenhower matrix",
      "Voice-to-task",
      "Screenshot-to-task",
      "Email-to-task",
      "Focus timer",
      "Habit tracker",
      "Weekly reviews",
      "Share groups",
      "Semantic search",
      "5 languages (EN, ZH-TW, ZH-CN, JA, KO)",
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function BlogPostJsonLd({
  title,
  description,
  date,
  updated,
  author,
  url,
  image,
}: {
  title: string;
  description: string;
  date: string;
  updated?: string;
  author: string;
  url: string;
  image?: string;
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: title,
    description,
    datePublished: date,
    dateModified: updated ?? date,
    author: {
      "@type": "Person",
      name: author,
    },
    publisher: {
      "@type": "Organization",
      name: "First Light",
      url: "https://firstlight.to",
    },
    url,
    ...(image && { image }),
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
