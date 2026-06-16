import Anthropic from "@anthropic-ai/sdk";

/**
 * Server-side Anthropic client. Returns null if ANTHROPIC_API_KEY is unset
 * so the app degrades gracefully — every AI feature checks this and falls
 * back to non-AI behavior (e.g. chrono-node parsing, no Daily Edition card).
 */
let _client: Anthropic | null | undefined;

export function getAnthropic(): Anthropic | null {
  if (_client !== undefined) return _client;
  const key = process.env.ANTHROPIC_API_KEY;
  _client = key ? new Anthropic({ apiKey: key }) : null;
  return _client;
}

export const MODELS = {
  // Cheap + fast: parsing, quadrant classification.
  // Dated Haiku 4.5 identifier — the alias `claude-haiku-4-5` is not
  // currently valid against the Messages API.
  fast: "claude-haiku-4-5-20251001",
  // Stronger reasoning + voice: Daily Edition, Weekly Retro, Morning Co-pilot.
  // NOTE: the old dated snapshot `claude-sonnet-4-20250514` was RETIRED by
  // Anthropic (~June 2026) and now returns 404, which surfaced as
  // "Daily Edition couldn't load" / "Couldn't load this morning's brief".
  // Use the current Sonnet 4.6 identifier.
  editorial: "claude-sonnet-4-6",
} as const;
