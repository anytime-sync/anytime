import { SiteFooter } from "@/components/site-footer";

export default function TermsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <SiteFooter />
    </>
  );
}
