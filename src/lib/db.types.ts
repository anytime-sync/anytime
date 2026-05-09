// Hand-written DB types. Keep in sync with supabase/migrations/0001_init.sql.
// (You can regenerate from `supabase gen types typescript` once you wire the CLI.)

export type Priority = 0 | 1 | 3 | 5;

export type Project = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  emoji: string | null;
  parent_id: string | null;
  position: number;
  is_archived: boolean;
  view_mode: "list" | "kanban" | "timeline";
  created_at: string;
  updated_at: string;
};

export type Tag = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  parent_id: string | null;
  created_at: string;
};

export type Task = {
  id: string;
  user_id: string;
  project_id: string | null;
  parent_id: string | null;
  title: string;
  notes: string | null;
  is_completed: boolean;
  completed_at: string | null;
  start_at: string | null;
  due_at: string | null;
  is_all_day: boolean;
  priority: Priority;
  position: number;
  rrule: string | null;
  reminder_at: string | null;
  estimated_pomodoros: number;
  spent_pomodoros: number;
  /** AI-predicted wall-clock minutes; populated by /api/ai/estimate-task. */
  estimated_minutes?: number | null;
  created_at: string;
  updated_at: string;
  /** Optional: a member of the task's share_group who owns the work. */
  assignee_id?: string | null;
  /** Optional: the share group this task belongs to (set by share picker). */
  share_group_id?: string | null;
};

export type TaskTag = {
  task_id: string;
  tag_id: string;
};

export type Habit = {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  goal_per_period: number;
  period: "day" | "week" | "month";
  active_days: number[];
  reminder_time: string | null;
  is_archived: boolean;
  created_at: string;
};

export type HabitLog = {
  id: string;
  habit_id: string;
  user_id: string;
  log_date: string; // yyyy-mm-dd
  count: number;
  note: string | null;
  created_at: string;
  /** When set, this row is a freeze/skip token rather than a real
   *  completion. Counts toward streak but not toward goal_per_period.
   *  Null on regular completion rows. */
  status?: "done" | "skipped" | "frozen" | null;
};

export type PomodoroSession = {
  id: string;
  user_id: string;
  task_id: string | null;
  kind: "focus" | "short_break" | "long_break";
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  completed: boolean;
  created_at: string;
};

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  theme: "light" | "dark" | "system";
  start_of_week: number;
  pomodoro_focus_min: number;
  pomodoro_short_break_min: number;
  pomodoro_long_break_min: number;
  pomodoro_long_every: number;
  created_at: string;
  updated_at: string;
};

/**
 * Round F — Google Calendar read-only sync.
 *
 * `calendar_events` is the local cache of events fetched from the
 * connected provider. Cancellations stay as rows with cancelled=true
 * so the UI can hide them without us losing audit history.
 */
export type CalendarEvent = {
  id: string;
  user_id: string;
  provider: "google";
  external_id: string;
  calendar_id: string;
  title: string | null;
  description: string | null;
  location: string | null;
  start_at: string | null;
  end_at: string | null;
  is_all_day: boolean;
  status: "confirmed" | "tentative" | "cancelled";
  html_link: string | null;
  organizer_email: string | null;
  attendees_count: number;
  raw: Record<string, unknown>;
  fetched_at: string;
  cancelled: boolean;
};
