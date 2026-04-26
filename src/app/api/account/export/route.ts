import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GDPR right of access — returns a JSON dump of every row owned by the
 * authenticated user. The response sets Content-Disposition so the
 * browser downloads it as a file rather than rendering it.
 */
export async function GET() {
  const supabase = createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const userId = u.user.id;

  // RLS already filters to the authenticated user for every table below,
  // so we can fetch with the regular client (no service role needed).
  const [
    profile, prefs, projects, tasks, taskTags, tags, habits, habitLogs,
    pomodoros, attachments, dailyEditions, weeklyRetros,
  ] = await Promise.all([
    supabase.from("profiles").select("*").maybeSingle(),
    supabase.from("user_preferences").select("*").maybeSingle(),
    supabase.from("projects").select("*"),
    supabase.from("tasks").select("*"),
    supabase.from("task_tags").select("*"),
    supabase.from("tags").select("*"),
    supabase.from("habits").select("*"),
    supabase.from("habit_logs").select("*"),
    supabase.from("pomodoro_sessions").select("*"),
    supabase.from("task_attachments").select("*"),
    supabase.from("daily_editions").select("*"),
    supabase.from("weekly_retros").select("*"),
  ]);

  const dump = {
    exported_at: new Date().toISOString(),
    user: {
      id: userId,
      email: u.user.email,
      created_at: u.user.created_at,
    },
    profile: profile.data,
    preferences: prefs.data,
    projects: projects.data ?? [],
    tasks: tasks.data ?? [],
    task_tags: taskTags.data ?? [],
    tags: tags.data ?? [],
    habits: habits.data ?? [],
    habit_logs: habitLogs.data ?? [],
    pomodoro_sessions: pomodoros.data ?? [],
    task_attachments: attachments.data ?? [],
    daily_editions: dailyEditions.data ?? [],
    weekly_retros: weeklyRetros.data ?? [],
  };

  const filename = `firstlight-export-${new Date().toISOString().slice(0, 10)}.json`;
  return new NextResponse(JSON.stringify(dump, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
