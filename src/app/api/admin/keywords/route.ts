import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/keywords?locale=xx
 * List all priority keyword phrases for a locale.
 */
export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const url = new URL(req.url);
  const locale = url.searchParams.get("locale") ?? "en";

  const { data, error } = await auth.ctx.admin
    .from("site_priority_keywords")
    .select("id, locale, phrase, priority, quadrant, enabled")
    .eq("locale", locale)
    .order("priority", { ascending: false })
    .order("phrase", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ rows: data });
}

/**
 * POST /api/admin/keywords
 * Body: { locale: string; phrase: string; priority: 0|1|3|5; quadrant?: q1|q2|q3|q4 }
 * Insert a new keyword. The trigger on the table maps priority -> quadrant
 * automatically when quadrant is omitted.
 */
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: {
    locale?: string;
    phrase?: string;
    priority?: number;
    quadrant?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const locale = (body.locale ?? "en").trim();
  const phrase = (body.phrase ?? "").trim();
  const priority = Number(body.priority ?? 0);
  if (!locale || !phrase) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  if (![0, 1, 3, 5].includes(priority)) {
    return NextResponse.json({ error: "invalid_priority" }, { status: 400 });
  }

  const row: Record<string, unknown> = {
    locale,
    phrase,
    priority,
    enabled: true,
  };
  if (body.quadrant) row.quadrant = body.quadrant;

  const { data, error } = await auth.ctx.admin
    .from("site_priority_keywords")
    .insert(row)
    .select("id, locale, phrase, priority, quadrant, enabled")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ row: data });
}
