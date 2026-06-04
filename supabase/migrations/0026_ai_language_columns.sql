-- ===================================================================
-- 0026_ai_language_columns.sql
-- Add 'language' column to daily_editions and weekly_retros so the
-- per-language caching strategy in the API routes actually works.
-- Without this, upserts with onConflict including 'language' fail
-- because the column doesn't exist and there's no matching unique index.
-- ===================================================================

-- ---------- daily_editions ----------
-- Add the column with a default so existing rows get 'en'.
alter table public.daily_editions
  add column if not exists language text not null default 'en';

-- Drop the old PK and replace with the per-language composite key.
-- The old PK is (user_id, edition_date). We need (user_id, edition_date, language).
alter table public.daily_editions
  drop constraint if exists daily_editions_pkey;

alter table public.daily_editions
  add constraint daily_editions_pkey
  primary key (user_id, edition_date, language);

-- ---------- weekly_retros ----------
alter table public.weekly_retros
  add column if not exists language text not null default 'en';

alter table public.weekly_retros
  drop constraint if exists weekly_retros_pkey;

alter table public.weekly_retros
  add constraint weekly_retros_pkey
  primary key (user_id, iso_year, iso_week, language);
