/**
 * One-shot Cloudflare API proxy — admin only.
 *
 * Lets the admin operator drive the Cloudflare REST API from the
 * browser when their workspace can't reach api.cloudflare.com directly
 * (CORS blocks the browser; egress allowlists block server fetches).
 *
 * Auth: admin email check via existing isAdminEmail() helper. The
 * Cloudflare API token is passed in the request body — never stored
 * server-side. After Cloudflare setup is complete, this route should
 * be deleted (it's intentionally specific to a one-time setup task).
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  token: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;          // e.g. "/zones" or "/zones/abc/email/routing/enable"
  body?: unknown;
  contentType?: string;  // override for non-JSON (e.g. Worker upload)
  rawBody?: string;      // sent as-is when set; useful for application/javascript
};

export async function POST(req: Request) {
  // Two acceptable auth modes:
  //  1. Logged-in admin session (browser tab already logged in)
  //  2. Bearer header equal to INBOUND_EMAIL_SECRET (operator script
  //     calling from a fresh tab; same secret already used by the
  //     email-to-task webhook so we don't add another env var).
  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.INBOUND_EMAIL_SECRET ?? ""}`;
  const headerOk =
    !!process.env.INBOUND_EMAIL_SECRET && auth === expected;

  if (!headerOk) {
    const supabase = await createClient();
    const { data: u } = await supabase.auth.getUser();
    if (!u.user || !isAdminEmail(u.user.email)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  let payload: Body;
  try {
    payload = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  if (!payload?.token || !payload?.path) {
    return NextResponse.json({ error: "missing_token_or_path" }, { status: 400 });
  }

  const url = "https://api.cloudflare.com/client/v4" + payload.path;
  const headers: Record<string, string> = {
    Authorization: "Bearer " + payload.token,
    "Content-Type": payload.contentType ?? "application/json",
  };

  let body: string | undefined;
  if (payload.rawBody !== undefined) {
    body = payload.rawBody;
  } else if (payload.body !== undefined) {
    body = JSON.stringify(payload.body);
  }

  try {
    const cf = await fetch(url, {
      method: payload.method ?? "GET",
      headers,
      body,
    });
    let json: unknown;
    const text = await cf.text();
    try { json = JSON.parse(text); } catch { json = { raw: text }; }
    return NextResponse.json({ status: cf.status, json }, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { error: "fetch_failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 502 }
    );
  }
}
