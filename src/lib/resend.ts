import { Resend } from "resend";

/**
 * Server-only Resend client. Returns null if RESEND_API_KEY is unset
 * so the email-reminder dispatcher can degrade gracefully — the rest
 * of the app keeps working without email.
 */
let _client: Resend | null | undefined;

export function getResend(): Resend | null {
  if (_client !== undefined) return _client;
  const key = process.env.RESEND_API_KEY;
  _client = key ? new Resend(key) : null;
  return _client;
}

/** Default From address. Override via env var when you've verified a domain
 *  on Resend (e.g. "First Light <reminders@firstlight.app>"). The
 *  onboarding@resend.dev fallback works out of the box for testing. */
export function getFromAddress(): string {
  return process.env.RESEND_FROM_ADDRESS ?? "First Light <onboarding@resend.dev>";
}
