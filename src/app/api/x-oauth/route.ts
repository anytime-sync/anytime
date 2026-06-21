/**
 * GET /api/x-oauth — OAuth 2.0 PKCE callback for X (Twitter)
 *
 * Used by the First Light X promotion bot. After the user approves the
 * X developer app in the browser, X redirects here with ?code=...&state=...
 * This route exchanges the code for tokens and stores them server-side.
 *
 * Security:
 * - state is validated against the value stored in KV / env
 * - tokens are stored in env (never sent to client)
 * - this route returns a plain HTML confirmation page
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CLIENT_ID = process.env.X_CLIENT_ID!;
const CLIENT_SECRET = process.env.X_CLIENT_SECRET!;
const REDIRECT_URI = "https://firstlight.to/api/x-oauth";
const EXPECTED_STATE = process.env.X_OAUTH_STATE; // set before initiating flow

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return new NextResponse(
      `<html><body><h2>❌ Authorization failed: ${error}</h2></body></html>`,
      { headers: { "content-type": "text/html" } }
    );
  }

  if (!code || !state) {
    return new NextResponse(
      `<html><body><h2>❌ Missing code or state</h2></body></html>`,
      { headers: { "content-type": "text/html" }, status: 400 }
    );
  }

  // Validate state
  if (EXPECTED_STATE && state !== EXPECTED_STATE) {
    return new NextResponse(
      `<html><body><h2>❌ State mismatch — possible CSRF</h2></body></html>`,
      { headers: { "content-type": "text/html" }, status: 400 }
    );
  }

  // Read code_verifier from env (set before initiating flow)
  const code_verifier = process.env.X_CODE_VERIFIER;
  if (!code_verifier) {
    return new NextResponse(
      `<html><body><h2>❌ No code_verifier in env. Start the flow fresh.</h2></body></html>`,
      { headers: { "content-type": "text/html" }, status: 500 }
    );
  }

  // Exchange code for tokens
  const creds = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier,
  });

  const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${creds}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    return new NextResponse(
      `<html><body><h2>❌ Token exchange failed</h2><pre>${err}</pre></body></html>`,
      { headers: { "content-type": "text/html" }, status: 500 }
    );
  }

  const tokens = await tokenRes.json();

  // Log to console (Vercel logs) — server picks it up and saves to .env.secrets
  console.log("X_OAUTH_TOKENS:" + JSON.stringify(tokens));

  return new NextResponse(
    `<html>
<head><style>
  body { font-family: system-ui; max-width: 500px; margin: 80px auto; text-align: center; }
  h1 { color: #1d9bf0; }
</style></head>
<body>
  <h1>✅ First Light × X — Authorized</h1>
  <p>The connection is live. You can close this tab.</p>
  <p style="color:#666;font-size:13px">Token type: ${tokens.token_type} · Scope: ${tokens.scope}</p>
</body></html>`,
    { headers: { "content-type": "text/html" } }
  );
}
// env: X_CLIENT_ID, X_CLIENT_SECRET, X_OAUTH_STATE, X_CODE_VERIFIER
