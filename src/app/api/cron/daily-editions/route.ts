import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function handle(req: Request) {
  if (!isAuthorizedCron(req.headers.get("authorization"))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ skipped: true, reason: "feature_retired" });
}
export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
