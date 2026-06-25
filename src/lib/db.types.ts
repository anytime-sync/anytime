// =============================================================================
// db.types.ts — Generated from supabase/migrations/*.sql
// Last regenerated: 2026-06-02
//
// Keep in sync with migrations. Re-run generation after adding new tables.
// =============================================================================

// ---------------------------------------------------------------------------
// Enums / unions
// ---------------------------------------------------------------------------

export type Priority = 0 | 1 | 3 | 5;
export type TaskStatus = "open" | "done" | "archived";
export type GoalStatus = "active" | "paused" | "done" | "archived";
export type SubscriptionPlan = "pro" | "team";
export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled" | "unpaid" | "incomplete" | "incomplete_expired" | "paused";
export type PlanOverridePlan = "free" | "pro" | "vip" | "team";
export type ProjectMemberRole = "owner" | "member" | "viewer";
export type PomodoroKind = "focus" | "short_break" | "long_break";
export type HabitPeriod = "day" | "week" | "month";
export type HabitLogStatus = "done" | "skipped" | "frozen";
export type CalendarProvider = "google";
export type CalendarEventStatus = "confirmed" | "tentative" | "cancelled";
export type ViewMode = "list" | "kanban" | "timeline";
export type Theme = "light" | "dark" | "system";
export type Language = "en" | "zh-TW" | "zh-CN" | "ja" | "ko";
export type AiFeature = "parse_task" | "quadrant" | "daily_edition" | "weekly_retro" | "morning_copilot" | "reschedule_task" | "prep_meeting";
export type CopilotLogStatus = "open" | "snoozed" | "dismissed" | "applied";
export type ShareGroupRole = "owner" | "admin" | "member";

// ---------------------------------------------------------------------------
// Core tables (0001_init.sql)
// ---------------------------------------------------------------------------

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  theme: Theme;
  start_of_week: number;
  pomodoro_focus_min: number;
  pomodoro_short_break_min: number;
  pomodoro_long_break_min: number;
  pomodoro_long_every: number;
  /** Added by user_preferences join in some queries. */
  language?: Language;
  created_at: string;
  updated_at: string;
};

export type Project = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  emoji: string | null;
  parent_id: string | null;
  position: number;
  is_archived: boolean;
  view_mode: ViewMode;
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
  /** Set by cron after email/push is dispatched (0006_reminders). */
  reminder_sent_at: string | null;
  estimated_pomodoros: number;
  spent_pomodoros: number;
  /** AI-predicted wall-clock minutes (0004_ai). */
  estimated_minutes: number | null;
  /** API compat alias for is_completed (0021_api_compat). */
  status: TaskStatus;
  /** Share group this task belongs to. */
  share_group_id: string | null;
  /** Assignee within the share group. */
  assignee_id: string | null;
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
  period: HabitPeriod;
  active_days: number[];
  reminder_time: string | null;
  is_archived: boolean;
  created_at: string;
};

export type HabitLog = {
  id: string;
  habit_id: string;
  user_id: string;
  log_date: string;
  count: number;
  note: string | null;
  status: HabitLogStatus | null;
  created_at: string;
};

export type PomodoroSession = {
  id: string;
  user_id: string;
  task_id: string | null;
  kind: PomodoroKind;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  completed: boolean;
  created_at: string;
};
// ---------------------------------------------------------------------------
// Billing (subscriptions.sql, plan_overrides.sql, vip_tier.sql)
// ---------------------------------------------------------------------------

export type Subscription = {
  user_id: string;
  ls_customer_id: string;
  ls_subscription_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
};

/** View: coalesces plan_overrides > active stripe sub > 'free'. */
export type UserPlan = {
  user_id: string;
  plan: "free" | "pro" | "team";
  status: SubscriptionStatus | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  is_manual_override: boolean;
  override_reason: string | null;
  override_expires_at: string | null;
};

export type PlanOverride = {
  user_id: string;
  plan: PlanOverridePlan;
  reason: string | null;
  set_by: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
};

// ---------------------------------------------------------------------------
// Sharing (0002_sharing.sql)
// ---------------------------------------------------------------------------

export type ProjectMember = {
  project_id: string;
  user_id: string;
  role: ProjectMemberRole;
  added_at: string;
};

// ---------------------------------------------------------------------------
// Attachments (0003_attachments.sql)
// ---------------------------------------------------------------------------

export type TaskAttachment = {
  id: string;
  task_id: string;
  user_id: string;
  storage_path: string;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Feature flags (0003_feature_flags.sql)
// ---------------------------------------------------------------------------

export type FeatureFlag = {
  feature_id: string;
  override_plan: "free" | "pro" | "team" | null;
  disabled: boolean;
  note: string | null;
  updated_at: string;
  updated_by: string | null;
};

// ---------------------------------------------------------------------------
// AI features (0004_ai.sql)
// ---------------------------------------------------------------------------

export type DailyEdition = {
  user_id: string;
  edition_date: string;
  language: string;
  kicker: string | null;
  headline: string | null;
  front_page: string | null;
  inside: string | null;
  below_fold: string | null;
  raw_json: Record<string, unknown> | null;
  model: string | null;
  generated_at: string;
  /** API compat aliases (0021_api_compat trigger-maintained). */
  date: string | null;
  title: string | null;
  body: string | null;
  sections: Record<string, unknown> | null;
};

export type WeeklyRetro = {
  user_id: string;
  iso_year: number;
  iso_week: number;
  week_start: string;
  language: string;
  shipped: string | null;
  slipped: string | null;
  drop_list: string | null;
  raw_json: Record<string, unknown> | null;
  model: string | null;
  generated_at: string;
};

export type UserPreferences = {
  user_id: string;
  daily_capacity_minutes: number;
  default_task_minutes: number;
  energy_peak_start: string;
  energy_peak_end: string;
  ai_enabled: boolean;
  ai_auto_quadrant: boolean;
  ai_daily_edition: boolean;
  ai_voice_enabled: boolean;
  language: Language;
  email_reminders: boolean;
  push_reminders: boolean;
  email_daily_digest: boolean;
  email_broadcasts: boolean;
  /** IANA timezone string, e.g. "Asia/Taipei". Defaults to "UTC" when unset. */
  timezone: string;
  /** Local hour (0–23) to send the daily digest. Defaults to 7. */
  digest_send_hour: number;
  /** ICS feed token (0014). */
  ics_feed_token: string | null;
  ics_feed_created_at: string | null;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Landing & CMS (0006_landing_config.sql, 0009_admin.sql, 0013_site_design.sql)
// ---------------------------------------------------------------------------

export type LandingConfig = {
  id: number;
  config: Record<string, unknown>;
  updated_at: string;
  updated_by: string | null;
};

export type SiteContent = {
  locale: string;
  key: string;
  value: string;
  updated_by: string | null;
  updated_at: string;
};

export type SiteDesign = {
  element_id: string;
  overrides: Record<string, unknown>;
  updated_by: string | null;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Push subscriptions (0007)
// ---------------------------------------------------------------------------

export type PushSubscription = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string;
};

// ---------------------------------------------------------------------------
// AI usage log (0008)
// ---------------------------------------------------------------------------

export type AiUsageLog = {
  id: number;
  user_id: string;
  feature: AiFeature;
  model: string | null;
  status: number | null;
  created_at: string;
};
// ---------------------------------------------------------------------------
// Analytics (0009_admin.sql)
// ---------------------------------------------------------------------------

export type AnalyticsEvent = {
  id: number;
  user_id: string | null;
  event_name: string;
  properties: Record<string, unknown>;
  occurred_at: string;
};

// ---------------------------------------------------------------------------
// Morning Co-pilot (0015)
// ---------------------------------------------------------------------------

export type DailyCopilotLog = {
  user_id: string;
  local_date: string;
  language: string;
  brief: Record<string, unknown>;
  status: CopilotLogStatus;
  surfaced_at: string | null;
  responded_at: string | null;
};

// ---------------------------------------------------------------------------
// Personal Access Tokens (0020)
// ---------------------------------------------------------------------------

export type PersonalAccessToken = {
  id: string;
  user_id: string;
  name: string;
  token_hash: string;
  token_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

// ---------------------------------------------------------------------------
// API request log (0020)
// ---------------------------------------------------------------------------

export type ApiRequestLog = {
  id: number;
  user_id: string;
  method: string;
  path: string;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Goals (0021_api_compat.sql)
// ---------------------------------------------------------------------------

export type Goal = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: GoalStatus;
  target_date: string | null;
  progress_pct: number;
  linked_task_count: number;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Calendar (init + 0022_calendar_events_timestamps)
// ---------------------------------------------------------------------------

export type CalendarEvent = {
  id: string;
  user_id: string;
  provider: CalendarProvider;
  external_id: string;
  calendar_id: string;
  title: string | null;
  description: string | null;
  location: string | null;
  start_at: string | null;
  end_at: string | null;
  is_all_day: boolean;
  status: CalendarEventStatus;
  html_link: string | null;
  organizer_email: string | null;
  attendees_count: number;
  raw: Record<string, unknown>;
  fetched_at: string;
  cancelled: boolean;
  /** API compat alias for is_all_day (generated column). */
  all_day: boolean;
  /** API compat alias for provider (generated column). */
  external_provider: string;
  /** Optional link to a task. */
  task_id: string | null;
  created_at: string;
  updated_at: string;
};

export type UserCalendarConnection = {
  id: string;
  user_id: string;
  provider: CalendarProvider;
  provider_account_id: string;
  provider_email: string | null;
  access_token_enc: string;
  refresh_token_enc: string | null;
  token_expires_at: string | null;
  calendar_ids: string[];
  sync_token: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PendingCalendarDeletion = {
  id: string;
  user_id: string;
  connection_id: string;
  external_id: string;
  calendar_id: string;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Share Groups (0024_share_group_task_rls + 0025_group_activity_drop_task_fk)
// ---------------------------------------------------------------------------

export type ShareGroup = {
  id: string;
  name: string;
  emoji: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type ShareGroupMember = {
  group_id: string;
  user_id: string;
  role: ShareGroupRole;
  joined_at: string;
};

export type ShareGroupInvite = {
  id: string;
  group_id: string;
  invited_email: string;
  invited_by: string;
  accepted_at: string | null;
  created_at: string;
};

export type GroupActivity = {
  id: string;
  group_id: string;
  actor_id: string;
  action: string;
  task_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};
// ---------------------------------------------------------------------------
// Notes & task links (referenced in code, likely dashboard-created)
// ---------------------------------------------------------------------------

export type Note = {
  id: string;
  user_id: string;
  title: string | null;
  content: string | null;
  created_at: string;
  updated_at: string;
};

export type NoteTaskLink = {
  note_id: string;
  task_id: string;
};

export type TaskComment = {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
};

export type TaskTranslation = {
  task_id: string;
  locale: string;
  title: string;
  notes: string | null;
};

// ---------------------------------------------------------------------------
// Reflections & digests
// ---------------------------------------------------------------------------

export type DailyReflection = {
  id: string;
  user_id: string;
  reflection_date: string;
  content: string | null;
  mood: string | null;
  created_at: string;
};

export type DailyDigestLog = {
  id: string;
  user_id: string;
  digest_date: string;
  sent_at: string;
  channel: string | null;
};

// ---------------------------------------------------------------------------
// Email inbox
// ---------------------------------------------------------------------------

export type EmailInboxLog = {
  id: string;
  user_id: string;
  from_email: string;
  subject: string | null;
  task_id: string | null;
  processed_at: string;
};

export type UserInboxAlias = {
  id: string;
  user_id: string;
  alias_email: string;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Admin & notifications
// ---------------------------------------------------------------------------

export type AdminImpersonationLog = {
  id: string;
  admin_id: string;
  target_user_id: string;
  reason: string | null;
  created_at: string;
};

export type AppNotification = {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  type: string | null;
  read_at: string | null;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Search & AI scheduling
// ---------------------------------------------------------------------------

export type SearchEmbedding = {
  id: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  content: string;
  embedding: number[];
  created_at: string;
};

export type TaskAgendaCache = {
  user_id: string;
  cache_date: string;
  agenda: Record<string, unknown>;
  generated_at: string;
};

// ---------------------------------------------------------------------------
// Site quadrant & priority config (admin)
// ---------------------------------------------------------------------------

export type SitePriorityKeyword = {
  id: string;
  keyword: string;
  priority: Priority;
  created_at: string;
};

export type SiteQuadrantConfig = {
  id: string;
  quadrant: string;
  config: Record<string, unknown>;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Supabase Database type helper
// ---------------------------------------------------------------------------

/**
 * Master database type map. Use with Supabase client generics:
 * 
 *   const supabase = createClient<Database>(...);
 *   supabase.from('tasks').select('*') // => Task[]
 */
export type Database = {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile> };
      projects: { Row: Project; Insert: Partial<Project>; Update: Partial<Project> };
      tags: { Row: Tag; Insert: Partial<Tag>; Update: Partial<Tag> };
      tasks: { Row: Task; Insert: Partial<Task>; Update: Partial<Task> };
      task_tags: { Row: TaskTag; Insert: TaskTag; Update: Partial<TaskTag> };
      task_attachments: { Row: TaskAttachment; Insert: Partial<TaskAttachment>; Update: Partial<TaskAttachment> };
      task_comments: { Row: TaskComment; Insert: Partial<TaskComment>; Update: Partial<TaskComment> };
      task_translations: { Row: TaskTranslation; Insert: TaskTranslation; Update: Partial<TaskTranslation> };
      habits: { Row: Habit; Insert: Partial<Habit>; Update: Partial<Habit> };
      habit_logs: { Row: HabitLog; Insert: Partial<HabitLog>; Update: Partial<HabitLog> };
      pomodoro_sessions: { Row: PomodoroSession; Insert: Partial<PomodoroSession>; Update: Partial<PomodoroSession> };
      goals: { Row: Goal; Insert: Partial<Goal>; Update: Partial<Goal> };
      notes: { Row: Note; Insert: Partial<Note>; Update: Partial<Note> };
      note_task_links: { Row: NoteTaskLink; Insert: NoteTaskLink; Update: Partial<NoteTaskLink> };
      subscriptions: { Row: Subscription; Insert: Partial<Subscription>; Update: Partial<Subscription> };
      plan_overrides: { Row: PlanOverride; Insert: Partial<PlanOverride>; Update: Partial<PlanOverride> };
      feature_flags: { Row: FeatureFlag; Insert: Partial<FeatureFlag>; Update: Partial<FeatureFlag> };
      project_members: { Row: ProjectMember; Insert: Partial<ProjectMember>; Update: Partial<ProjectMember> };
      daily_editions: { Row: DailyEdition; Insert: Partial<DailyEdition>; Update: Partial<DailyEdition> };
      weekly_retros: { Row: WeeklyRetro; Insert: Partial<WeeklyRetro>; Update: Partial<WeeklyRetro> };
      user_preferences: { Row: UserPreferences; Insert: Partial<UserPreferences>; Update: Partial<UserPreferences> };
      daily_copilot_log: { Row: DailyCopilotLog; Insert: Partial<DailyCopilotLog>; Update: Partial<DailyCopilotLog> };
      ai_usage_log: { Row: AiUsageLog; Insert: Partial<AiUsageLog>; Update: Partial<AiUsageLog> };
      push_subscriptions: { Row: PushSubscription; Insert: Partial<PushSubscription>; Update: Partial<PushSubscription> };
      landing_config: { Row: LandingConfig; Insert: Partial<LandingConfig>; Update: Partial<LandingConfig> };
      site_content: { Row: SiteContent; Insert: SiteContent; Update: Partial<SiteContent> };
      site_design: { Row: SiteDesign; Insert: Partial<SiteDesign>; Update: Partial<SiteDesign> };
      analytics_events: { Row: AnalyticsEvent; Insert: Partial<AnalyticsEvent>; Update: Partial<AnalyticsEvent> };
      calendar_events: { Row: CalendarEvent; Insert: Partial<CalendarEvent>; Update: Partial<CalendarEvent> };
      user_calendar_connections: { Row: UserCalendarConnection; Insert: Partial<UserCalendarConnection>; Update: Partial<UserCalendarConnection> };
      pending_calendar_deletions: { Row: PendingCalendarDeletion; Insert: Partial<PendingCalendarDeletion>; Update: Partial<PendingCalendarDeletion> };
      personal_access_tokens: { Row: PersonalAccessToken; Insert: Partial<PersonalAccessToken>; Update: Partial<PersonalAccessToken> };
      api_request_log: { Row: ApiRequestLog; Insert: Partial<ApiRequestLog>; Update: Partial<ApiRequestLog> };
      share_groups: { Row: ShareGroup; Insert: Partial<ShareGroup>; Update: Partial<ShareGroup> };
      share_group_members: { Row: ShareGroupMember; Insert: Partial<ShareGroupMember>; Update: Partial<ShareGroupMember> };
      share_group_invites: { Row: ShareGroupInvite; Insert: Partial<ShareGroupInvite>; Update: Partial<ShareGroupInvite> };
      group_activity: { Row: GroupActivity; Insert: Partial<GroupActivity>; Update: Partial<GroupActivity> };
      daily_reflections: { Row: DailyReflection; Insert: Partial<DailyReflection>; Update: Partial<DailyReflection> };
      daily_digest_log: { Row: DailyDigestLog; Insert: Partial<DailyDigestLog>; Update: Partial<DailyDigestLog> };
      email_inbox_log: { Row: EmailInboxLog; Insert: Partial<EmailInboxLog>; Update: Partial<EmailInboxLog> };
      user_inbox_aliases: { Row: UserInboxAlias; Insert: Partial<UserInboxAlias>; Update: Partial<UserInboxAlias> };
      admin_impersonation_log: { Row: AdminImpersonationLog; Insert: Partial<AdminImpersonationLog>; Update: Partial<AdminImpersonationLog> };
      app_notifications: { Row: AppNotification; Insert: Partial<AppNotification>; Update: Partial<AppNotification> };
      search_embeddings: { Row: SearchEmbedding; Insert: Partial<SearchEmbedding>; Update: Partial<SearchEmbedding> };
      task_agenda_cache: { Row: TaskAgendaCache; Insert: Partial<TaskAgendaCache>; Update: Partial<TaskAgendaCache> };
      site_priority_keywords: { Row: SitePriorityKeyword; Insert: Partial<SitePriorityKeyword>; Update: Partial<SitePriorityKeyword> };
      site_quadrant_config: { Row: SiteQuadrantConfig; Insert: Partial<SiteQuadrantConfig>; Update: Partial<SiteQuadrantConfig> };
    };
    Views: {
      user_plans: { Row: UserPlan };
    };
  };
};
