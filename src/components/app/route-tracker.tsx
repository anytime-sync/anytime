"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { trackPageview } from "@/lib/track";

/**
 * RouteTracker — fires a Plausible pageview on every Next.js route change.
 *
 * Plausible's "manual" script doesn't auto-track SPAs, so we hook into
 * the App Router hooks. The first render counts as the initial pageview;
 * subsequent renders fire on real navigation.
 *
 * No-op if Plausible isn't loaded (NEXT_PUBLIC_PLAUSIBLE_DOMAIN unset).
 */
export function RouteTracker() {
  const pathname = usePathname();
  const search = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    const url =
      pathname + (search?.toString() ? "?" + search.toString() : "");
    trackPageview(window.location.origin + url);
  }, [pathname, search]);

  return null;
}
