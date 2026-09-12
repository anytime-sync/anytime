import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Retired: briefs are generated only when requested. Keep this authenticated
// no-op for old scheduler invocations during deployment propagation.
function handle(req: Request) {
  if (!isAuthorizedCron(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ generated: 0, disabled: true, reason: "Use Brief me on demand." });
}
export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
