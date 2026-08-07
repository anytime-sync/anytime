import Link from "next/link";
import { BlogEmailCapture } from "@/components/marketing/blog-email-capture";

/**
 * DailyEditionCta — inline conversion band shown at the foot of every blog post.
 *
 * The blog is First Light's main top-of-funnel (24 posts, indexed) but nothing
 * routed a reader toward a signup tied to the product's core value prop. This
 * band gives every post a single, high-intent conversion surface.
 *
 * Growth loop step 2: instead of linking out to /signup, we capture the email
 * inline and send a passwordless magic link (<BlogEmailCapture/> ->
 * POST /api/auth/magic-link). The link lands the reader straight in /app with
 * a pre-seeded first Daily Edition, so the core value is visible in under a
 * minute with no password step.
 *
 *   • data-cta="blog-daily-edition" is a stable hook for click instrumentation.
 *   • ?ref=blog is carried into the new user's metadata for attribution once
 *     the GA4 / GSC analytics loop is restored.
 *
 * Server component — the interactive form lives in the client child.
 */
export function DailyEditionCta() {
  return (
    <aside
      data-cta="blog-daily-edition"
      className="card mt-16 px-6 py-8 text-center sm:px-8 sm:py-9"
    >
      <p className="editorial-number text-[11px]">Your Daily Edition</p>
      <h2 className="mt-2 font-display text-2xl leading-tight tracking-tight md:text-3xl">
        Start tomorrow already planned
      </h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-fg">
        First Light gathers your tasks, calendar, and habits into one calm
        morning briefing — your whole day, in under a minute. Free to start, no
        credit card.
      </p>

      <BlogEmailCapture />

      <p className="mx-auto mt-4 max-w-md text-xs leading-relaxed text-muted-fg">
        Enter your email and we’ll send a magic link — no password to create.{" "}
        <Link href="/" className="underline transition-colors hover:text-fg">
          See how it works →
        </Link>
      </p>
    </aside>
  );
}
