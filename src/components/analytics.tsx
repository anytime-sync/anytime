import Script from "next/script";

/**
 * Conditional analytics loader. Scripts only render when the matching
 * env var is set, so the site stays fast and cookie-free in development.
 *
 * To activate, add the following to Vercel env vars (Settings → Environment):
 *   NEXT_PUBLIC_GA_ID       e.g. G-XXXXXXXXXX  (Google Analytics 4)
 *   NEXT_PUBLIC_CLARITY_ID  e.g. abc123def4    (Microsoft Clarity)
 */
export function Analytics() {
  const ga = process.env.NEXT_PUBLIC_GA_ID;
  const clarity = process.env.NEXT_PUBLIC_CLARITY_ID;
  return (
    <>
      {ga && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${ga}`}
            strategy="afterInteractive"
          />
          <Script id="ga-init" strategy="afterInteractive">{`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${ga}', { anonymize_ip: true });
          `}</Script>
        </>
      )}
      {clarity && (
        <Script id="ms-clarity" strategy="afterInteractive">{`
          (function(c,l,a,r,i,t,y){
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window, document, "clarity", "script", "${clarity}");
        `}</Script>
      )}
    </>
  );
}
