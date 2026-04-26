import Link from "next/link";

export const metadata = {
  title: "Terms of Service — First Light",
  description: "The rules of using First Light.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen px-6 py-16">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <Link href="/" className="wordmark text-base text-muted-fg hover:text-fg">First Light</Link>
          <p className="editorial-number text-[10px] mt-6">Terms of Service</p>
          <h1 className="font-display text-4xl tracking-tight leading-tight mt-1">
            Plain words for a plain agreement.
          </h1>
          <p className="text-sm text-muted-fg mt-2">Last updated: April 2026</p>
        </div>

        <Section heading="The deal">
          <p>
            First Light is a personal task and habit app. By using it, you
            agree to these terms. They are deliberately short. If anything is
            unclear, ask.
          </p>
        </Section>

        <Section heading="Your account">
          <p>
            You&apos;re responsible for what happens under your account. Don&apos;t
            share your password. If you sign in with Google or Apple, the
            account is bound to that identity. Tell us if you suspect
            unauthorized access.
          </p>
        </Section>

        <Section heading="Acceptable use">
          <p>You agree not to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Try to break, scrape, or overload the service</li>
            <li>Use the AI features to generate harmful or unlawful content</li>
            <li>Use First Light for storing illegal content</li>
            <li>Pretend to be someone you&apos;re not</li>
          </ul>
        </Section>

        <Section heading="Your content">
          <p>
            Your tasks, notes, attachments — all of it — belong to you. We
            host them so you can use them across devices. We don&apos;t look
            at them or use them for training models. The only time content
            leaves our servers is during AI feature requests, where it&apos;s
            sent to Anthropic for a single inference and not retained under
            their commercial agreement.
          </p>
        </Section>

        <Section heading="Service availability">
          <p>
            We aim for high uptime but make no guarantee. If something
            breaks, we&apos;ll work to fix it; we don&apos;t owe credits or
            refunds for outages on the free tier.
          </p>
        </Section>

        <Section heading="Termination">
          <p>
            You can delete your account anytime from Settings. We may suspend
            accounts that violate these terms — we&apos;ll tell you why and
            give you a chance to export your data first, except in cases of
            abuse where we may act immediately.
          </p>
        </Section>

        <Section heading="Limitation of liability">
          <p>
            First Light is provided &quot;as is.&quot; To the maximum extent
            permitted by law, we&apos;re not liable for indirect or
            consequential damages arising from your use of the service. Our
            aggregate liability for any claim is limited to the amount you
            paid us in the prior twelve months — which, on the free tier,
            is zero.
          </p>
        </Section>

        <Section heading="Changes">
          <p>
            We may revise these terms. Material changes will be announced by
            email at least 14 days before they take effect. Continued use
            after that means you accept the updated terms.
          </p>
        </Section>

        <Section heading="Governing law">
          <p>
            These terms are governed by the laws of the jurisdiction where
            our company is registered. Disputes will be handled in the
            courts of that jurisdiction.
          </p>
        </Section>

        <p className="text-xs text-muted-fg pt-8 border-t border-border">
          See our <Link href="/privacy" className="hover:text-fg underline">Privacy Policy</Link>
          {" "}for how we handle your data.
        </p>
      </div>
    </main>
  );
}

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl tracking-tight">{heading}</h2>
      <div className="text-[15px] leading-relaxed text-fg/85 space-y-3">{children}</div>
    </section>
  );
}
