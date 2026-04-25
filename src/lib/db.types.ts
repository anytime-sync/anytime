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
  created_at: string;
  updated_at: string;
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
