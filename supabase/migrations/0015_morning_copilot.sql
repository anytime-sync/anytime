-- Round E v1: Morning Co-pilot. Once-a-day proactive brief cached per
-- (user, local_date, language). The migration here is a source-of-truth
-- copy of `round_e_morning_copilot` (already applied to the live
-- database via Supabase MCP). Keeping it in the migrations folder lets
-- a fresh database bootstrap correctly.

-- ---------- daily_copilot_log ----------
create table if not exists daily_copilot_log (
  user_id      uuid not null references auth.users(id) on delete cascade,
  local_date   date not null,
  language     text not null,
  brief        jsonb not null default '{}'::jsonb,
  status       text not null default 'open',
  surfaced_at  timestamptz default now(),
  responded_at timestamptz,
  primary key (user_id, local_date, language),
  constraint daily_copilot_log_status_chk
    check (status in ('open', 'snoozed', 'dismissed', 'applied'))
);
create index if not exists daily_copilot_log_user_idx
  on daily_copilot_log(user_id, local_date desc);

-- ---------- RLS ----------
alter table daily_copilot_log enable row level security;

drop policy if exists daily_copilot_log_select_own on daily_copilot_log;
create policy daily_copilot_log_select_own on daily_copilot_log
  for select using (auth.uid() = user_id);

drop policy if exists daily_copilot_log_insert_own on daily_copilot_log;
create policy daily_copilot_log_insert_own on daily_copilot_log
  for insert with check (auth.uid() = user_id);

drop policy if exists daily_copilot_log_update_own on daily_copilot_log;
create policy daily_copilot_log_update_own on daily_copilot_log
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
