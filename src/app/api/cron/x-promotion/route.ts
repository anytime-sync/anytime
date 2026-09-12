import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { dispatchPromotion } from "@/lib/x-promotion";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  if (!isAuthorizedCron(req.headers.get("authorization"))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // Vercel previews share environment variables but must never publish.
  if (process.env.VERCEL_ENV !== "production") return NextResponse.json({ state: "production_only" });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "store_unavailable" }, { status: 503 });
  return NextResponse.json(await dispatchPromotion(createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })), { headers: { "Cache-Control": "no-store" } });
}
