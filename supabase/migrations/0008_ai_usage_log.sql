-- ===================================================================
-- 0008_ai_usage_log.sql
-- Per-user AI usage log for rate limiting + cost visibility.
-- ===================================================================
create table if not exists ai_usage_log (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null check (feature in ('parse_task','quadrant','daily_edition','weekly_retro')),
  model text,
  status int,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_log_user_day_idx
  on ai_usage_log (user_id, created_at desc);

alter table ai_usage_log enable row level security;
drop policy if exists own_usage on ai_usage_log;
create policy own_usage on ai_usage_log for select using (auth.uid() = user_id);
