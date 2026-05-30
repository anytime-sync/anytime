import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Log in — First Light",
    description: "Sign in to First Light — your calm space for clarity, focus, intentional progress.",
    alternates: { canonical: "/login" },
    openGraph: {
          title: "Log in — First Light",
          description: "Sign in to First Light.",
          url: "https://firstlight.to/login",
          images: ["/og.png"],
    },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
    return children;
}
