import type { Metadata, Viewport } from "next";
import { Inter, Cormorant_Garamond, Outfit } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "sonner";
import { SwRegister } from "@/components/app/sw-register"; import { Analytics } from "@/components/analytics";
import { PhotoBackground } from "@/components/photo-background";
import { LanguageBootstrap } from "@/components/app/language-bootstrap";
import { I18nOverridesBootstrap } from "@/components/app/i18n-overrides-bootstrap";
import { RouteTracker } from "@/components/app/route-tracker";
import { Suspense } from "react";
import { DesignProvider } from "@/lib/design/provider";
import { DesignEditMode } from "@/lib/design/edit-mode";
import { SoftwareApplicationJsonLd } from "@/components/json-ld";
import { fetchDesignMap } from "@/lib/design/fetch-server";
import { generateClassOverridesCss } from "@/lib/design/class-css";
import { fetchSiteOverrides } from "@/lib/i18n-server";
import { setI18nOverrides, type LanguageCode } from "@/lib/i18n";

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
  // English baseline for the meta description. LanguageBootstrap swaps
  // this for the localized poetic version on the client when the user's
  // stored language isn't English — so search bots / link previews see
  // English (acceptable, this is the canonical SEO copy), but visitors
  // see their language in the browser tab and any Open Graph readers
  // that re-resolve after page load.
  description:
    "First Light · A calm daily productivity tool for getting things done.",
  metadataBase: new URL("https://firstlight.to"), alternates: { canonical: "/" }, openGraph: { type: "website", siteName: "First Light", title: "First Light — your space for clarity, focus, intentional progress", description: "A calm daily productivity tool. Read once in the morning; the day is shaped.", url: "https://firstlight.to", locale: "en_US", images: [{ url: "/og.png", width: 1200, height: 630, alt: "First Light" }] }, twitter: { card: "summary_large_image", title: "First Light — your space for clarity, focus, intentional progress", description: "A calm daily productivity tool. Read once in the morning; the day is shaped.", images: ["/og.png"] }, robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } }, keywords: ["productivity app", "task manager", "AI daily planner", "Google Calendar sync", "Eisenhower matrix", "weekly review", "paste to task", "voice to task", "snapshot to task", "First Light"], authors: [{ name: "First Light" }], category: "productivity", verification: { google: "WIOio_NT9ylh9an2yaMZgJ30nhbmR_Pb0o4e9FDWxPY" }, manifest: "/manifest.webmanifest",
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

// Force every route through this layout to be rendered on demand.
// Several client components below (RouteTracker, DesignEditMode,
// PhotoBackground, the per-locale i18n bootstrap) read URL params and
// cookies that don't exist at static build time. With static
// rendering Next.js bails out with "useSearchParams() should be
// wrapped in a suspense boundary" even when we wrap them ourselves.
// Forcing dynamic here keeps things simple AND lets the design slot
// system render fresh overrides on every request.
export const dynamic = "force-dynamic";

// Google Fonts URL bundling the CJK families used per language.
// All loaded eagerly but the browser only fetches the unicode-range
// segments that contain characters actually present on the page —
// English visitors don't pay for CJK bytes.
const CJK_FONTS_HREF =
  "https://fonts.googleapis.com/css2?" +
  [
    "family=Noto+Sans+TC:wght@400;500",
    "family=Noto+Serif+TC:wght@400;500",
    "family=Noto+Sans+SC:wght@400;500",
    "family=Noto+Serif+SC:wght@400;500",
    "family=Noto+Sans+JP:wght@400;500",
    "family=Shippori+Mincho+B1:wght@400;500",
    "family=Noto+Sans+KR:wght@400;500",
    "family=Nanum+Myeongjo:wght@400;700",
    "display=swap",
  ].join("&");

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Seed the DesignProvider with the full site_design map. Public read
  // policy means anonymous landing visitors get overrides too.
  const designMap = await fetchDesignMap();

  // Compile class-targeted overrides into a single CSS string injected
  // into <head>. Per-class entries (id `class:editorial-number` etc.)
  // produce rules selected by `[lang="xx"]` and `html.dark` /
  // `html.fl-night-preview` so the right per-language per-mode style
  // wins without any client-side resolution. Generated server-side, so
  // the rules are present on the very first paint.
  const classCss = generateClassOverridesCss(designMap);

  // Pull admin-edited text overrides server-side so SSR HTML already
  // has the saved strings. The same map is also serialized into a
  // window var below so the client i18n module is seeded BEFORE
  // hydration, which kills the flash of hardcoded defaults.
  const i18nOverrides = await fetchSiteOverrides();
  for (const code of Object.keys(i18nOverrides) as LanguageCode[]) {
    setI18nOverrides(code, i18nOverrides[code]!);
  }

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
        {/* Class-targeted design overrides. Server-rendered as plain
            CSS so per-language per-mode rules are present on the very
            first paint (no FOUC). The selectors use [lang="xx"] and
            html.dark / html.fl-night-preview which are already kept in
            sync by LanguageBootstrap and the next-themes provider, so
            no extra client wiring is needed. */}
        {classCss && (
          <style
            id="fl-class-overrides"
            dangerouslySetInnerHTML={{ __html: classCss }}
          />
        )}
        {/* Plausible — privacy-respecting analytics. Loaded only when
            NEXT_PUBLIC_PLAUSIBLE_DOMAIN is set (Vercel env var). The
            script is < 1kb, sets no cookies, sends no personal data, and
            ignores DNT. The "manual" extension lets us track custom
            events via window.plausible() (see src/lib/track.ts). */}
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
        <SoftwareApplicationJsonLd />
        {/* Hand the freshly-fetched i18n overrides to the client BEFORE
            React hydrates. The bootstrap component reads this window
            var on module load and seeds setI18nOverrides synchronously,
            so t() returns overrides on the very first hydration pass. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__I18N_INITIAL_OVERRIDES = ${JSON.stringify(
              i18nOverrides
            ).replace(/</g, "\u003c")};`,
          }}
        />
        <LanguageBootstrap />
        <I18nOverridesBootstrap />
        <DesignProvider initial={designMap}>
          <Providers>
            <PhotoBackground />
            {/* useSearchParams suspends in App Router; wrap in Suspense
                so the rest of the tree streams in regardless. */}
            <Suspense fallback={null}>
              <RouteTracker />
              <DesignEditMode />
            </Suspense>
            {children}
          </Providers>
        </DesignProvider>
        <Toaster position="bottom-right" richColors closeButton />
        <SwRegister /><Analytics />
      </body>
    </html>
  );
}
