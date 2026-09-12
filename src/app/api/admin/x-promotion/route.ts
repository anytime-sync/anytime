import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";
import { dispatchPromotion, PROMOTION_HOURS } from "@/lib/x-promotion";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status, headers });
  const db = auth.ctx.admin;
  const [control, queue] = await Promise.all([
    db.from("x_promotion_control").select("enabled,pause_reason,last_tick_at").eq("id", 1).single(),
    db.from("x_promotion_queue").select("id,brand,body,scheduled_at,status,result_url,error").gte("scheduled_at", new Date(Date.now() - 86400000).toISOString()).order("scheduled_at").limit(60),
  ]);
  if (control.error || queue.error) return NextResponse.json({ error: "schedule_unavailable" }, { status: 503, headers });
  return NextResponse.json({ control: control.data, queue: queue.data, hours: PROMOTION_HOURS }, { headers });
}
export async function POST(req: NextRequest) {
  if (req.headers.get("origin") !== new URL(req.url).origin) return NextResponse.json({ error: "invalid_origin" }, { status: 403, headers });
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status, headers });
  const payload = await req.json().catch(() => null);
  if (process.env.VERCEL_ENV !== "production") return NextResponse.json({ error: "production_only" }, { status: 403, headers });
  if (payload?.action === "dispatch") return NextResponse.json(await dispatchPromotion(auth.ctx.admin), { headers });
  if (payload?.action === "pause" || payload?.action === "resume") {
    const { error } = await auth.ctx.admin.from("x_promotion_control").update({ enabled: payload.action === "resume", pause_reason: payload.action === "pause" ? "paused_by_owner" : null }).eq("id", 1);
    return NextResponse.json(error ? { error: "update_failed" } : { state: payload.action }, { status: error ? 503 : 200, headers });
  }
  return NextResponse.json({ error: "invalid_action" }, { status: 400, headers });
}
