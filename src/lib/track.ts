"use client";

/**
 * Analytics tracking helpers — NO-OP.
 *
 * Plausible was removed 2026-07-07 (subscription not renewed). These
 * functions are kept as no-ops so existing callers (RouteTracker, UI
 * event handlers) don't need to change. If a new analytics provider is
 * wired up later, implement the bodies here and every call site picks
 * it up automatically.
 */

type Props = Record<string, string | number | boolean>;

/** Standard pageview. No-op — analytics provider removed. */
export function trackPageview(_url: string): void {
  /* no-op */
}

/**
 * Custom event. No-op — analytics provider removed.
 *
 * Historical event names used in this app (for reference if analytics
 * is re-added):
 *   task.created           { source: "quick_add" | "manual" | "import" | "voice" }
 *   task.completed
 *   ai.invoked             { feature }
 *   ai.budget_exceeded     { feature }
 *   language.changed       { from, to }
 *   theme.toggled          { to: "light" | "dark" }
 *   plan_week.applied      { count }
 *   voice.dictation        { lang }
 */
export function track(_event: string, _props?: Props): void {
  /* no-op */
}
