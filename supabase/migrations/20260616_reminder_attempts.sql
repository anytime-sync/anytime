-- ===================================================================
-- 20260616_reminder_attempts.sql
-- Harden reminder dispatch against (a) double-sends from overlapping
-- cron ticks and (b) retry-forever loops on permanently-failing sends.
--
-- Strategy:
--   * reminder_attempts  — how many delivery attempts have been made.
--   * reminder_failed_at — set when we give up after MAX_ATTEMPTS so the
--                          row is permanently excluded from the due query
--                          (acts as a dead-letter marker, distinct from a
--                          successful reminder_sent_at).
--
-- The dispatcher now CLAIMS a task (sets reminder_sent_at = now() only
-- when it is still NULL) BEFORE sending, so two overlapping ticks can
-- never both grab the same row. On failure it releases the claim
-- (reminder_sent_at -> NULL) and bumps reminder_attempts; once attempts
-- hit the cap it stamps reminder_failed_at and stops retrying.
-- ===================================================================

alter table tasks
  add column if not exists reminder_attempts integer not null default 0;

alter table tasks
  add column if not exists reminder_failed_at timestamptz;

-- Replace the partial index so the dispatcher's hot-path query stays
-- index-only. A task is "due" when it has a reminder time in the past,
-- has not been sent, has not been permanently failed, and is open.
drop index if exists tasks_reminder_due_idx;

create index if not exists tasks_reminder_due_idx
  on tasks (reminder_at)
  where reminder_at is not null
    and reminder_sent_at is null
    and reminder_failed_at is null
    and is_completed = false;
