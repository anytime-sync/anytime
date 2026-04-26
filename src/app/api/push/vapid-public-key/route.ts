import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Returns the VAPID public key for the client to use when subscribing. */
export async function GET() {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) return NextResponse.json({ error: "vapid_disabled" }, { status: 503 });
  return NextResponse.json({ publicKey: key });
}
