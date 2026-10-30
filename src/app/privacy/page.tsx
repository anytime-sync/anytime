import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — First Light",
  description: "How First Light handles your data.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen px-6 py-16">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <Link href="/" className="wordmark text-base text-muted-fg hover:text-fg">First Light</Link>
          <p className="editorial-number text-[10px] mt-6">Privacy Policy</p>
          <h1 className="font-display text-4xl tracking-tight leading-tight mt-1">
            What we keep, why, and what we don&apos;t.
          </h1>
          <p className="text-sm text-muted-fg mt-2">Service descriptions corrected: October 18, 2026</p>
        </div>

        <Section heading="What we store">
          <p>
            When you sign up we store your email address and an optional display
            name. When you create tasks, lists, tags, habits, Pomodoro sessions,
            attachments, or notes, we store them in our Supabase-hosted Postgres
            database and storage services. Account access controls protect this
            content. Content you share through Groups is accessible to the people
            you share it with; authorized integrations can access permitted records.
          </p>
          <p>
            AI-assisted features can send relevant task text, notes, calendar
            context, queries or submitted images to Anthropic for processing.
            This includes parsing during task capture as well as requested
            briefings and reviews. Generated content and usage records may be
            stored in First Light. We do not promise zero retention by Anthropic;
            its <a href="https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data" className="underline">API retention policy</a>
            {" "}describes standard retention and exceptions.
          </p>
          <p>
            Semantic search can send text to Voyage AI to generate embeddings.
            Google Calendar, Telegram, email delivery and authorized MCP clients
            process the information needed for the connected features you use.
            Paid checkout is handled by Lemon Squeezy. These services have their
            own privacy terms.
          </p>
        </Section>

        <Section heading="What we don't do">
          <p>
            We don&apos;t sell your data. We don&apos;t serve advertising. We
            don&apos;t share your tasks with third parties for marketing.
          </p>
        </Section>

        <Section heading="Email">
          <p>
            Email supports account access, reminders, configured digests and
            product communications. Settings → Notifications controls reminder
            preferences. Where an unsubscribe option is provided, use it to stop
            that category of message. Account-access messages are separate from
            optional reminders and newsletters.
          </p>
        </Section>

        <Section heading="Cookies and analytics">
          <p>
            We set a session cookie via Supabase Auth so you stay signed in.
            We use <code>localStorage</code> to remember your language choice
            and the order of items in your sidebar. We use Vercel Analytics and
            Speed Insights to understand usage and performance, and record product
            interaction events. Google Analytics and Microsoft Clarity may also
            be loaded when configured; those services can collect additional
            usage information and use browser storage or cookies. This is not a
            tracking-free service.
          </p>
        </Section>

        <Section heading="Your rights">
          <p>
            <strong>Access.</strong> Settings → Your data → Download as JSON
            exports the supported account records, including tasks, lists, tags,
            habits, focus sessions and saved reviews. It is not an export of every
            stored record or attachment file. Contact us for additional access requests.
          </p>
          <p>
            <strong>Erasure.</strong> Settings → Danger zone → Delete my account
            requests permanent account deletion and removal of linked records
            through the account deletion process. This cannot be reversed from the
            app; export first if you want a copy. Contact us about records held by
            connected providers or other data not covered by the app controls.
          </p>
          <p>
            <strong>Correction.</strong> You can edit any task, list, tag,
            habit, note, or display name from the app at any time.
          </p>
          <p>
            For other requests (questions, complaints, regulator inquiries),
            email <a href="mailto:info@firstlight.to" className="underline">info@firstlight.to</a>.
          </p>
        </Section>

        <Section heading="Children">
          <p>First Light is not directed at children under 13.</p>
        </Section>

        <Section heading="Changes">
          <p>
            If this policy changes materially we will notify you by email
            before the changes take effect.
          </p>
        </Section>

        <p className="text-xs text-muted-fg pt-8 border-t border-border">
          First Light is operated and hosted on enterprise-grade infrastructure. For questions about this Privacy Policy, email{" "}
          <a href="mailto:info@firstlight.to" className="hover:text-fg underline">info@firstlight.to</a>.
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
