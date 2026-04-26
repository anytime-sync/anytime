-- AI features: Daily Edition, Weekly Retro, user preferences, capacity tracking.
-- Enables pgvector for future memory/personalization work.

create extension if not exists vector;

-- =====================================================================
-- daily_editions: morning briefing in editorial voice, cached per day.
-- =====================================================================
create table if not exists daily_editions (
  user_id uuid not null references auth.users(id) on delete cascade,
  edition_date date not null,
  kicker text,
  headline text,
  front_page text,
  inside text,
  below_fold text,
  raw_json jsonb,
  model text,
  generated_at timestamptz not null default now(),
  primary key (user_id, edition_date)
);
alter table daily_editions enable row level security;
drop policy if exists own_editions on daily_editions;
create policy own_editions on daily_editions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =====================================================================
-- weekly_retros: 'last week's edition' — what shipped, slipped, drop.
-- Keyed by ISO year+week; week_start helps with display.
-- =====================================================================
create table if not exists weekly_retros (
  user_id uuid not null references auth.users(id) on delete cascade,
  iso_year int not null,
  iso_week int not null,
  week_start date not null,
  shipped text,
  slipped text,
  drop_list text,
  raw_json jsonb,
  model text,
  generated_at timestamptz not null default now(),
  primary key (user_id, iso_year, iso_week)
);
alter table weekly_retros enable row level security;
drop policy if exists own_retros on weekly_retros;
create policy own_retros on weekly_retros for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =====================================================================
-- user_preferences: capacity caps, energy windows, AI feature flags.
-- =====================================================================
create table if not exists user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  daily_capacity_minutes int not null default 240,    -- 4h deep work
  default_task_minutes int not null default 30,
  energy_peak_start time not null default '09:00',
  energy_peak_end time not null default '12:00',
  ai_enabled boolean not null default true,
  ai_auto_quadrant boolean not null default false,    -- opt-in
  ai_daily_edition boolean not null default true,
  ai_voice_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table user_preferences enable row level security;
drop policy if exists own_prefs on user_preferences;
create policy own_prefs on user_preferences for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.create_user_prefs()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.user_preferences (user_id) values (new.id)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_prefs on auth.users;
create trigger on_auth_user_created_prefs
  after insert on auth.users
  for each row execute function public.create_user_prefs();

-- Backfill existing users.
insert into user_preferences (user_id)
select id from auth.users on conflict do nothing;

-- =====================================================================
-- task estimated_minutes — used by anti-overload + auto-schedule.
-- =====================================================================
alter table tasks add column if not exists estimated_minutes int;

-- =====================================================================
-- Realtime publication.
-- =====================================================================
do $$ begin
  alter publication supabase_realtime add table daily_editions;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table weekly_retros;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table user_preferences;
exception when duplicate_object then null; end $$;
