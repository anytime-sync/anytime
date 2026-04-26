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
  fast: "claude-haiku-4-5",
  // Stronger reasoning + voice: Daily Edition, Weekly Retro.
  editorial: "claude-sonnet-4-6",
} as const;
