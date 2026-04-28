-- 0009_admin.sql
-- Admin surface: site_content CMS table for runtime-editable
-- translations, plus an analytics_events table for custom event
-- tracking that we can roll into the admin insights dashboard.
-- Auth is gated in the app layer by checking the user's email against
-- the hardcoded admin email — keeping the schema simple.

-- ---------- site_content (CMS-managed translatable strings) ----------
-- Admin Content editor writes here. The app reads `site_content` first;
-- if no row exists for (locale, key), the hardcoded i18n.ts wins.
create table if not exists site_content (
  locale text not null,
  key text not null,
  value text not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz default now(),
  primary key (locale, key)
);

alter table site_content enable row level security;

-- Public reads — landing page must render strings without auth.
drop policy if exists "site_content_public_read" on site_content;
create policy "site_content_public_read"
  on site_content for select
  using (true);

-- Only the admin email can mutate.
drop policy if exists "site_content_admin_insert" on site_content;
create policy "site_content_admin_insert"
  on site_content for insert
  to authenticated
  with check (
    exists (
      select 1 from auth.users
      where auth.users.id = auth.uid()
        and auth.users.email = 'anytime.sync@gmail.com'
    )
  );

drop policy if exists "site_content_admin_update" on site_content;
create policy "site_content_admin_update"
  on site_content for update
  to authenticated
  using (
    exists (
      select 1 from auth.users
      where auth.users.id = auth.uid()
        and auth.users.email = 'anytime.sync@gmail.com'
    )
  );

drop policy if exists "site_content_admin_delete" on site_content;
create policy "site_content_admin_delete"
  on site_content for delete
  to authenticated
  using (
    exists (
      select 1 from auth.users
      where auth.users.id = auth.uid()
        and auth.users.email = 'anytime.sync@gmail.com'
    )
  );

-- ---------- analytics_events (custom event log) ----------
-- Lightweight first-party telemetry feeding the admin Insights tab.
-- `properties` is JSONB so each event type can carry its own payload
-- (task_completed.priority, ai_called.feature, etc.).
create table if not exists analytics_events (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete set null,
  event_name text not null,
  properties jsonb default '{}'::jsonb,
  occurred_at timestamptz default now()
);

create index if not exists idx_analytics_user
  on analytics_events(user_id, occurred_at desc);
create index if not exists idx_analytics_event_time
  on analytics_events(event_name, occurred_at desc);

alter table analytics_events enable row level security;

-- Users can insert their own events (client-side track() calls).
drop policy if exists "analytics_user_insert" on analytics_events;
create policy "analytics_user_insert"
  on analytics_events for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Only admin can read the aggregate.
drop policy if exists "analytics_admin_read" on analytics_events;
create policy "analytics_admin_read"
  on analytics_events for select
  to authenticated
  using (
    exists (
      select 1 from auth.users
      where auth.users.id = auth.uid()
        and auth.users.email = 'anytime.sync@gmail.com'
    )
  );

-- ---------- admin RPC: aggregate dashboard ----------
-- Single round-trip helper for the Insights page so we don't slam the
-- DB with 8 separate queries from the client.
create or replace function admin_dashboard_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  is_admin boolean;
  result jsonb;
begin
  select exists (
    select 1 from auth.users
    where auth.users.id = auth.uid()
      and auth.users.email = 'anytime.sync@gmail.com'
  ) into is_admin;

  if not is_admin then
    raise exception 'forbidden';
  end if;

  select jsonb_build_object(
    'total_users', (select count(*) from auth.users),
    'signups_7d',
      (select count(*) from auth.users
        where created_at > now() - interval '7 days'),
    'signups_30d',
      (select count(*) from auth.users
        where created_at > now() - interval '30 days'),
    'active_7d',
      (select count(distinct user_id) from tasks
        where updated_at > now() - interval '7 days'),
    'total_tasks', (select count(*) from tasks),
    'completed_tasks',
      (select count(*) from tasks where is_completed = true),
    'total_pomodoros',
      (select count(*) from pomodoro_sessions),
    'total_habits', (select count(*) from habits),
    'language_breakdown',
      coalesce(
        (select jsonb_object_agg(coalesce(language, 'en'), c)
          from (
            select language, count(*) as c
              from profiles
              group by language
          ) t),
        '{}'::jsonb
      ),
    'signups_by_day',
      coalesce(
        (select jsonb_agg(jsonb_build_object('day', d, 'count', c)
          order by d)
          from (
            select date_trunc('day', created_at)::date as d, count(*) as c
              from auth.users
              where created_at > now() - interval '30 days'
              group by 1
          ) t),
        '[]'::jsonb
      )
  ) into result;

  return result;
end;
$$;

grant execute on function admin_dashboard_summary() to authenticated;

-- ---------- admin RPC: members list ----------
create or replace function admin_members_list()
returns table (
  id uuid,
  email text,
  full_name text,
  language text,
  created_at timestamptz,
  last_active timestamptz,
  task_count bigint,
  completed_count bigint,
  pomodoro_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from auth.users u
    where u.id = auth.uid()
      and u.email = 'anytime.sync@gmail.com'
  ) then
    raise exception 'forbidden';
  end if;

  return query
    select
      u.id,
      u.email::text,
      p.full_name,
      coalesce(p.language, 'en'),
      u.created_at,
      greatest(
        (select max(updated_at) from tasks t where t.user_id = u.id),
        (select max(started_at) from pomodoro_sessions ps where ps.user_id = u.id)
      ) as last_active,
      (select count(*) from tasks t where t.user_id = u.id),
      (select count(*) from tasks t where t.user_id = u.id and t.is_completed),
      (select count(*) from pomodoro_sessions ps where ps.user_id = u.id)
    from auth.users u
    left join profiles p on p.id = u.id
    order by u.created_at desc;
end;
$$;

grant execute on function admin_members_list() to authenticated;
