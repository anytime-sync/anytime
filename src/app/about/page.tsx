import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";

export const metadata = {
  title: "About — First Light",
  description:
    "Who builds First Light, where it is operated from, and how to reach us.",
  alternates: { canonical: "https://firstlight.to/about" },
};

export default function AboutPage() {
  return (
    <>
      <main className="min-h-screen px-6 py-16">
        <div className="max-w-2xl mx-auto space-y-8">
          <div>
            <Link
              href="/"
              className="wordmark text-base text-muted-fg hover:text-fg"
            >
              First Light
            </Link>
            <p className="editorial-number text-[10px] mt-6">About</p>
            <h1 className="font-display text-4xl tracking-tight leading-tight mt-1">
              A calm planner, built by one person.
            </h1>
          </div>

          <Section heading="Who runs this">
            <p>
              First Light is an independent product built and operated by Yulin Cheng, a
              solo developer based in Taipei, Taiwan. It is not a front for a
              larger company, and it is not affiliated with, endorsed by, or
              sponsored by any other productivity app or brand mentioned on this
              site.
            </p>
            <p>
              The app lives at{" "}
              <Link href="/" className="text-accent hover:underline">
                firstlight.to
              </Link>
              . Everything on this domain — the marketing pages, the app itself,
              the API — is operated by the same person. There are no resellers
              and no white-label copies.
            </p>
          </Section>

          <Section heading="What First Light is">
            <p>
              A daily planner that brings tasks, calendar, habits and a Pomodoro
              timer into one place, and writes you a short Daily Edition
              briefing each morning so you start the day knowing what matters
              instead of staring at a list of forty things.
            </p>
            <p>
              It speaks English and Traditional Chinese natively, and it exposes
              an MCP server so an AI assistant you already use can read and
              update your real tasks.
            </p>
          </Section>

          <Section heading="How it makes money">
            <p>
              Subscriptions, and only subscriptions. There is a free tier and
              there are paid tiers — see{" "}
              <Link href="/pricing" className="text-accent hover:underline">
                pricing
              </Link>
              . We do not sell data, we do not run advertising, and we do not
              embed third-party tracking pixels. The full detail is in the{" "}
              <Link href="/privacy" className="text-accent hover:underline">
                privacy policy
              </Link>
              .
            </p>
          </Section>

          <Section heading="On the comparison pages">
            <p>
              Some pages on this site compare First Light with other planners by
              name. Those product names and logos are the trademarks of their
              respective owners. First Light is not affiliated with any of them,
              and those pages are our own opinion, written to help you decide
              whether to switch — not to imitate anyone.
            </p>
          </Section>

          <Section heading="Reaching a human">
            <p>
              Email{" "}
              <a
                href="mailto:hello@firstlight.to"
                className="text-accent hover:underline"
              >
                hello@firstlight.to
              </a>
              . One person reads it, and you will get a real reply. More ways to
              get in touch are on the{" "}
              <Link href="/contact" className="text-accent hover:underline">
                contact page
              </Link>
              .
            </p>
          </Section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function Section({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl tracking-tight">{heading}</h2>
      <div className="text-[15px] leading-relaxed text-fg/85 space-y-3">
        {children}
      </div>
    </section>
  );
}
