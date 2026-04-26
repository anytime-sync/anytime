-- ===================================================================
-- 0007_push_subscriptions.sql
-- Web push notification subscriptions (one row per (user, endpoint)).
-- ===================================================================
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index if not exists push_subscriptions_user_idx on push_subscriptions(user_id);

alter table push_subscriptions enable row level security;

drop policy if exists own_subs_select on push_subscriptions;
create policy own_subs_select on push_subscriptions for select
  using (auth.uid() = user_id);

drop policy if exists own_subs_insert on push_subscriptions;
create policy own_subs_insert on push_subscriptions for insert
  with check (auth.uid() = user_id);

drop policy if exists own_subs_delete on push_subscriptions;
create policy own_subs_delete on push_subscriptions for delete
  using (auth.uid() = user_id);

-- Per-user push toggle on user_preferences (separate from email_reminders)
alter table user_preferences
  add column if not exists push_reminders boolean not null default true;
