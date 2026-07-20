import Link from "next/link";

/**
 * DailyEditionCta — inline conversion band shown at the foot of every blog post.
 *
 * The blog is First Light's main top-of-funnel (24 posts, indexed) but nothing
 * routed a reader toward a signup tied to the product's core value prop. This
 * band gives every post a single, high-intent conversion surface.
 *
 *   • Links to /signup?ref=blog  — the ?ref lets us attribute blog-sourced
 *     signups once the GA4 / GSC analytics loop is restored.
 *   • data-cta="blog-daily-edition" is a stable hook for click instrumentation.
 *
 * Server component (no client state) — safe to render inside the async
 * blog post page.
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
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/signup?ref=blog"
          className="btn-primary h-10 px-5 text-sm"
        >
          Start your Daily Edition — free
        </Link>
        <Link
          href="/"
          className="text-sm text-muted-fg transition-colors hover:text-fg"
        >
          See how it works →
        </Link>
      </div>
    </aside>
  );
}
