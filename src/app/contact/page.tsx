import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";

export const metadata = {
  title: "Contact — First Light",
  description:
    "How to reach the person who builds and operates First Light.",
  alternates: { canonical: "https://firstlight.to/contact" },
};

export default function ContactPage() {
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
            <p className="editorial-number text-[10px] mt-6">Contact</p>
            <h1 className="font-display text-4xl tracking-tight leading-tight mt-1">
              There is a person at this address.
            </h1>
            <p className="text-sm text-muted-fg mt-2">
              First Light is operated by Yulin Cheng, an independent developer in Taipei,
              Taiwan.
            </p>
          </div>

          <Section heading="Email">
            <p>
              <a
                href="mailto:hello@firstlight.to"
                className="text-accent hover:underline text-lg"
              >
                hello@firstlight.to
              </a>
            </p>
            <p>
              Use this for anything: support, billing, bug reports, privacy and
              data requests, press, or partnership. Replies usually come within
              two business days.
            </p>
          </Section>

          <Section heading="Privacy and data requests">
            <p>
              To export or delete your data you do not need to email anyone —
              Settings → Your data → Download as JSON gives you a complete
              export, and Settings → Danger zone → Delete my account removes
              everything tied to your account. If you would rather have a human
              do it, email the address above and say so.
            </p>
            <p>
              The full policy is at{" "}
              <Link href="/privacy" className="text-accent hover:underline">
                /privacy
              </Link>
              .
            </p>
          </Section>

          <Section heading="Security reports">
            <p>
              If you have found a vulnerability, email the address above with
              &ldquo;security&rdquo; in the subject line. Please give us a
              reasonable window to fix it before disclosing publicly. We will
              credit you if you want the credit.
            </p>
          </Section>

          <Section heading="Trademark and affiliation">
            <p>
              First Light is not affiliated with, endorsed by, or sponsored by
              any other product named on this site. Other product names and
              logos belong to their respective owners. If you own a brand we
              mention and want a page changed, email us and we will act on it
              quickly.
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
