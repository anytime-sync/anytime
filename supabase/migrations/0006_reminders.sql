-- ===================================================================
-- 0006_reminders.sql
-- Email reminder dispatch: idempotency column on tasks + opt-out flag
-- on user_preferences.
-- ===================================================================
alter table tasks
  add column if not exists reminder_sent_at timestamptz;

create index if not exists tasks_reminder_due_idx
  on tasks (reminder_at)
  where reminder_at is not null
    and reminder_sent_at is null
    and is_completed = false;

alter table user_preferences
  add column if not exists email_reminders boolean not null default true;
