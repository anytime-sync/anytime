-- Migration: add timezone, digest preferences, and email broadcast columns
-- to user_preferences, and create daily_digest_log for idempotency.
-- These columns existed in the live DB without a migration file; this
-- migration is safe to run on a fresh DB and is idempotent (IF NOT EXISTS).

-- 1. Timezone: IANA string, e.g. "Asia/Taipei". Defaults to UTC.
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'UTC';

-- 2. Daily digest opt-in (default true = all existing users receive it).
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS email_daily_digest boolean NOT NULL DEFAULT true;

-- 3. Broadcast emails opt-in (newsletters, announcements).
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS email_broadcasts boolean NOT NULL DEFAULT true;

-- 4. Local hour (0–23) to send the daily digest. Default = 7am.
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS digest_send_hour smallint NOT NULL DEFAULT 7
  CONSTRAINT digest_send_hour_range CHECK (digest_send_hour >= 0 AND digest_send_hour <= 23);

-- 5. Daily digest log: one row per (user, local_date) so cron retries
--    never duplicate sends even if Vercel fires the job twice.
CREATE TABLE IF NOT EXISTS daily_digest_log (
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sent_for_date date      NOT NULL,
  email_id    text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, sent_for_date)
);

ALTER TABLE daily_digest_log ENABLE ROW LEVEL SECURITY;

-- Users can read their own log (useful for debugging in the app).
CREATE POLICY IF NOT EXISTS "users can read own digest log"
  ON daily_digest_log FOR SELECT
  USING (auth.uid() = user_id);
