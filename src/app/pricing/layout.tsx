import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Pricing — First Light",
    description: "Free, Plus, and Pro plans for the calm daily productivity tool. Daily brief, AI plan-my-day, voice/snapshot/paste to task, Google Calendar sync, weekly review.",
    alternates: { canonical: "/pricing" },
    openGraph: {
          title: "Pricing — First Light",
          description: "Free, Plus $4, Pro $9. Calm daily productivity.",
          url: "https://firstlight.to/pricing",
          images: ["/og.png"],
    },
    twitter: {
          title: "Pricing — First Light",
          description: "Free, Plus $4, Pro $9. Calm daily productivity.",
          images: ["/og.png"],
    },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
    return children;
}
