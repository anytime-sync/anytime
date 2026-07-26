import Link from "next/link";

/**
 * Sitewide trust footer.
 *
 * Exists for a specific reason: firstlight.to was flagged by Google Safe
 * Browsing as a "deceptive page" in July 2026. A large contributor is that
 * the domain collected credentials (/signup, /login) while carrying no
 * visible operator identity — no About, no Contact, no ownership statement.
 * Rendering this on every public page is the cheapest durable fix.
 *
 * Keep the About and Contact links here. Do not remove them.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="px-6 py-8 border-t border-border">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-muted-fg">
        <p>
          &copy; {year} First Light — an independent product built and operated
          by Yulin Cheng in Taipei, Taiwan.
        </p>
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <Link href="/about" className="hover:text-fg transition-colors">
            About
          </Link>
          <Link href="/contact" className="hover:text-fg transition-colors">
            Contact
          </Link>
          <Link href="/pricing" className="hover:text-fg transition-colors">
            Pricing
          </Link>
          <Link href="/privacy" className="hover:text-fg transition-colors">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-fg transition-colors">
            Terms
          </Link>
        </nav>
      </div>
    </footer>
  );
}
