import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { TrademarkNotice } from "@/components/trademark-notice";

export const metadata: Metadata = {
  robots: { index: true, follow: true },
};

export default function AlternativesLayout({
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
