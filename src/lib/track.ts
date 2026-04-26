"use client";

/**
 * Plausible tracking helpers.
 *
 * Plausible is loaded by layout.tsx as a deferred script. We use the
 * "manual" build so route changes don't auto-track — the SPA never
 * reloads, and we want to count meaningful events not micro-navigation.
 *
 * No cookies, no PII, no fingerprinting.
 */

type Props = Record<string, string | number | boolean>;

type PlausibleFn = (event: string, opts?: { props?: Props; u?: string }) => void;

function plausible(): PlausibleFn | null {
  if (typeof window === "undefined") return null;
  const fn = (window as any).plausible as PlausibleFn | undefined;
  return fn ?? null;
}

/** Standard pageview, fired by RouteTracker on every route change. */
export function trackPageview(url: string) {
  const p = plausible();
  if (!p) return;
  p("pageview", { u: url });
}

/**
 * Custom event. Names are dot-namespaced so they group nicely.
 *
 * Standard names in this app:
 *   task.created           { source: "quick_add" | "manual" | "import" | "voice" }
 *   task.completed
 *   ai.invoked             { feature }
 *   ai.budget_exceeded     { feature }
 *   language.changed       { from, to }
 *   theme.toggled          { to: "light" | "dark" }
 *   plan_week.applied      { count }
 *   voice.dictation        { lang }
 */
export function track(event: string, props?: Props) {
  const p = plausible();
  if (!p) return;
  p(event, props ? { props } : undefined);
}
