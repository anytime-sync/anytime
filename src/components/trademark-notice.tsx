/**
 * Non-affiliation / trademark disclaimer.
 *
 * Rendered on every page that names a competitor (/compare/*, /alternatives/*,
 * and the competitor-named blog posts). Part of the July 2026 remediation of
 * the Google Safe Browsing "deceptive pages" flag on firstlight.to: using other
 * brands' names on a young domain without an explicit non-affiliation statement
 * reads as impersonation to the classifier.
 *
 * Deliberately generic so it is correct on any page regardless of which
 * products are mentioned. Do not remove.
 */
export function TrademarkNotice() {
  return (
    <aside className="px-6 pb-10">
      <div className="max-w-6xl mx-auto">
        <p className="text-xs text-muted-fg leading-relaxed border-t border-border pt-6">
          First Light is an independent product operated by Yulin Cheng in Taipei,
          Taiwan. It is not affiliated with, endorsed by, or sponsored by any of
          the products or companies named on this page. All product names,
          logos, and trademarks are the property of their respective owners and
          are used here only for identification and honest comparison.
          Comparisons reflect publicly available information at the time of
          writing; see{" "}
          <a href="/about" className="underline hover:text-fg">
            About
          </a>{" "}
          for who we are and{" "}
          <a href="/contact" className="underline hover:text-fg">
            Contact
          </a>{" "}
          to reach us.
        </p>
      </div>
    </aside>
  );
}
