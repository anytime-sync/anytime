import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import {
  acceptCalendarReview,
  reviewCalendarTask,
  CalendarReviewError,
} from "@/lib/calendar-review";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function context() {
  const {
    data: { user },
  } = await createClient().auth.getUser();
  if (!user) throw new CalendarReviewError("unauthorized", 401);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new CalendarReviewError("Calendar review unavailable.", 503);
  return {
    user,
    db: createServiceClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
  };
}
function failure(error: unknown) {
  return NextResponse.json(
    {
      error:
        error instanceof CalendarReviewError
          ? error.message
          : "Calendar review failed. Refresh before trying again.",
    },
    { status: error instanceof CalendarReviewError ? error.status : 503 },
  );
}
export async function GET(req: Request) {
  try {
    const { user, db } = await context();
    const taskId = new URL(req.url).searchParams.get("taskId");
    if (taskId)
      return NextResponse.json(
        (await reviewCalendarTask(db, user.id, taskId)).result,
      );
    const { data, error } = await db
      .from("tasks")
      .select("id,title,calendar_dirty,calendar_conflict,calendar_event_id")
      .eq("user_id", user.id)
      .or(
        "calendar_conflict.not.is.null,and(calendar_dirty.eq.true,or(calendar_event_id.not.is.null,and(is_completed.eq.false,status.neq.done,status.neq.archived,parent_id.is.null,or(start_at.not.is.null,due_at.not.is.null))))",
      )
      .order("updated_at", { ascending: false })
      .limit(101);
    if (error) throw error;
    // Unscheduled native tasks have nothing to send; use the same eligibility
    // as Sync now rather than describing every dirty row as pending.
    return NextResponse.json({
      items: (data ?? []).slice(0, 100),
      truncated: (data?.length ?? 0) > 100,
    });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(req: Request) {
  try {
    const { user, db } = await context();
    const body = await req.json();
    if (
      typeof body.taskId !== "string" ||
      !/^[a-f0-9]{64}$/.test(body.review ?? "") ||
      body.choice !== "calendar"
    )
      throw new CalendarReviewError("Invalid review request.", 400);
    return NextResponse.json(
      await acceptCalendarReview(db, user.id, body.taskId, body.review),
    );
  } catch (error) {
    return failure(error);
  }
}
