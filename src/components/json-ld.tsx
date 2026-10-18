/**
 * JSON-LD structured data for SEO.
 * Renders in <head> via Next.js metadata API or as a <script> tag.
 *
 * Prices are passed as props from server components that call loadPrices().
 * This ensures JSON-LD always reflects the admin-configured prices.
 */

export function SoftwareApplicationJsonLd({
  plusPrice,
  proPrice,
}: {
  plusPrice?: string;
  proPrice?: string;
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "First Light",
    description:
      "A personal planner for tasks, notes, calendars, habits and focus.",
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
        price: plusPrice ?? "5.00",
        priceCurrency: "USD",
      },
      {
        "@type": "Offer",
        name: "Pro",
        price: proPrice ?? "9.00",
        priceCurrency: "USD",
      },
    ],
    author: {
      "@type": "Person",
      name: "Aaron Cheng",
      url: "https://firstlight.to",
    },
    inLanguage: ["en", "zh-TW", "zh-CN", "ja", "ko"],
    featureList: [
      "API/MCP integration",
      "Telegram bot",
      "Google Calendar sync",
      "Eisenhower matrix",
      "Email-to-task",
      "Focus timer",
      "Habit tracker",
      "Share groups",
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

export function BlogIndexJsonLd({
  posts,
}: {
  posts: Array<{ slug: string; title: string; description: string; date: string }>;
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "First Light Blog",
    description: "Thoughts on calm productivity, personal planning, and building a daily practice that sticks.",
    url: "https://firstlight.to/blog",
    publisher: {
      "@type": "Organization",
      name: "First Light",
      url: "https://firstlight.to",
    },
    blogPost: posts.map((p) => ({
      "@type": "BlogPosting",
      headline: p.title,
      description: p.description,
      datePublished: p.date,
      url: `https://firstlight.to/blog/${p.slug}`,
    })),
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
