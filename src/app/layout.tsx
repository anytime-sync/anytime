import type { Metadata, Viewport } from "next";
import { Inter, Cormorant_Garamond, Outfit } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "sonner";
import { SwRegister } from "@/components/app/sw-register";
import { PhotoBackground } from "@/components/photo-background";
import { LanguageBootstrap } from "@/components/app/language-bootstrap";
import { RouteTracker } from "@/components/app/route-tracker";
import { Suspense } from "react";

// Inter — Söhne stand-in for English UI / body / labels.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Cormorant Garamond — editorial serif for English hero headlines.
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});

// Outfit — wordmark "FIRST LIGHT" lockup. English-only brand mark.
const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: "First Light — your space for clarity, focus, intentional progress",
  description:
    "A calm operating system for getting things done. Tasks, calendar, habits, Pomodoro — synced anywhere.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAF7F2" },
    { media: "(prefers-color-scheme: dark)", color: "#111111" },
  ],
  width: "device-width",
  initialScale: 1,
};

// Google Fonts URL bundling the CJK families used per language.
// All loaded eagerly but the browser only fetches the unicode-range
// segments that contain characters actually present on the page —
// English visitors don't pay for CJK bytes.
const CJK_FONTS_HREF =
  "https://fonts.googleapis.com/css2?" +
  [
    // zh-TW / zh-CN: Noto Sans CJK at heavy weights for editorial
    // hero headings (matches the bold-sans aesthetic, not mincho/song).
    // Serif TC/SC kept for any in-content quote / pull-quote use.
    "family=Noto+Sans+TC:wght@400;500;700;900",
    "family=Noto+Serif+TC:wght@400;500",
    "family=Noto+Sans+SC:wght@400;500;700;900",
    "family=Noto+Serif+SC:wght@400;500",
    "family=Noto+Sans+JP:wght@400;500",
    "family=Shippori+Mincho+B1:wght@400;500",
    "family=Noto+Sans+KR:wght@400;500",
    "family=Nanum+Myeongjo:wght@400;700",
    "display=swap",
  ].join("&");

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${cormorant.variable} ${outfit.variable}`}
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href={CJK_FONTS_HREF} rel="stylesheet" />
        {/* Plausible — privacy-respecting analytics. Loaded only when
            NEXT_PUBLIC_PLAUSIBLE_DOMAIN is set (Vercel env var). The script
            is < 1kb, sets no cookies, sends no personal data. The "manual"
            extension lets us track custom events via window.plausible(). */}
        {process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN && (
          <>
            <script
              defer
              data-domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN}
              src="https://plausible.io/js/script.manual.js"
            />
            <script
              dangerouslySetInnerHTML={{
                __html:
                  "window.plausible = window.plausible || function(){(window.plausible.q = window.plausible.q || []).push(arguments)}",
              }}
            />
          </>
        )}
      </head>
      <body>
        <LanguageBootstrap />
        <Providers>
          <PhotoBackground />
          {/* useSearchParams suspends in App Router; wrap so the rest of
              the tree streams in regardless. */}
          <Suspense fallback={null}>
            <RouteTracker />
          </Suspense>
          {children}
        </Providers>
        <Toaster position="bottom-right" richColors closeButton />
        <SwRegister />
      </body>
    </html>
  );
}
