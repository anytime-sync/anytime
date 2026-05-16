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
          <p className="text-sm text-muted-fg mt-2">Last updated: April 2026</p>
        </div>

        <Section heading="What we store">
          <p>
            When you sign up we store your email address and an optional display
            name. When you create tasks, lists, tags, habits, Pomodoro sessions,
            attachments, or notes, we store them in our Supabase-hosted Postgres
            database — they belong to your account and are protected by row-level
            security so no other user can read them.
          </p>
          <p>
            If you opt into AI features, the contents of your tasks (titles, due
            dates, project names, completion timestamps) are sent to Anthropic
            for the duration of a single request to generate your Daily Edition
            briefing, your Weekly Review, the natural-language quick-add parser,
            or the Eisenhower auto-classifier. Anthropic does not retain the
            content under their commercial terms; the generated text is stored
            on our database for caching.
          </p>
        </Section>

        <Section heading="What we don't do">
          <p>
            We don&apos;t sell your data. We don&apos;t serve advertising. We
            don&apos;t share your tasks with third parties for marketing. We
            don&apos;t track you across the web — there is no Google Analytics
            or pixel running on the app.
          </p>
        </Section>

        <Section heading="Email">
          <p>
            We send transactional email from <code>onboarding@resend.dev</code>
            (or our verified domain when configured) only when you have set a
            reminder on a task and that reminder time has passed. Every email
            includes a one-click unsubscribe link, and Settings → Notifications
            lets you turn email reminders off entirely.
          </p>
        </Section>

        <Section heading="Cookies">
          <p>
            We set a session cookie via Supabase Auth so you stay signed in.
            We use <code>localStorage</code> to remember your language choice
            and the order of items in your sidebar. We don&apos;t use any
            tracking or analytics cookies.
          </p>
        </Section>

        <Section heading="Your rights">
          <p>
            <strong>Access.</strong> Settings → Your data → Download as JSON
            gives you a complete export of every row we store about you.
          </p>
          <p>
            <strong>Erasure.</strong> Settings → Danger zone → Delete my account
            permanently removes your account and every record tied to it. This
            cannot be reversed; export first if you want a copy.
          </p>
          <p>
            <strong>Correction.</strong> You can edit any task, list, tag,
            habit, note, or display name from the app at any time.
          </p>
          <p>
            For other requests (questions, complaints, regulator inquiries),
            email us — the address is in your reminder emails.
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
          First Light is operated and hosted on enterprise-grade infrastructure. For questions about this Privacy Policy, contact support through the app or via your account settings.
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
