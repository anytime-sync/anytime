import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Sign up — First Light",
    description: "Start free in 30 seconds. Calm daily productivity — daily brief, AI plan-my-day, snapshot/voice/paste to task, Google Calendar sync.",
    alternates: { canonical: "/signup" },
    openGraph: {
          title: "Start free — First Light",
          description: "A calm place to get things done. Sign up free.",
          url: "https://firstlight.to/signup",
          images: ["/og.png"],
    },
    twitter: {
          title: "Start free — First Light",
          description: "A calm place to get things done.",
          images: ["/og.png"],
    },
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
    return children;
}
