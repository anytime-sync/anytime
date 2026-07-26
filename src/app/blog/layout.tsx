import { SiteFooter } from "@/components/site-footer";
import { TrademarkNotice } from "@/components/trademark-notice";

/**
 * Several blog posts are competitor-named ("first-light-vs-*"). The trademark
 * notice is worded generically so it stays accurate on posts that name no
 * competitor at all, which lets it live at the layout level rather than being
 * threaded through every MDX post.
 */
export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <TrademarkNotice />
      <SiteFooter />
    </>
  );
}
