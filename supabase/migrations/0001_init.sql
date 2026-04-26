-- First Light schema. Run this in the Supabase SQL editor.
-- Idempotent-ish; safe to re-run on a fresh project.

create extension if not exists "pgcrypto";

-- ---------- profiles ----------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  -- preferences
  theme text default 'system',           -- 'light' | 'dark' | 'system'
  start_of_week int default 1,           -- 0=Sun, 1=Mon
  pomodoro_focus_min int default 25,
  pomodoro_short_break_min int default 5,
  pomodoro_long_break_min int default 15,
  pomodoro_long_every int default 4,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------- projects (lists) ----------
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text default '#4772fa',           -- hex
  emoji text,
  parent_id uuid references projects(id) on delete cascade,
  position double precision default 0,
  is_archived boolean default false,
  view_mode text default 'list',          -- 'list' | 'kanban' | 'timeline'
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists projects_user_idx on projects(user_id);

-- ---------- tags ----------
create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text default '#6b7280',
  parent_id uuid references tags(id) on delete cascade,
  created_at timestamptz default now(),
  unique (user_id, name)
);
create index if not exists tags_user_idx on tags(user_id);

-- ---------- tasks ----------
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  parent_id uuid references tasks(id) on delete cascade,    -- subtasks
  title text not null,
  notes text,
  is_completed boolean default false,
  completed_at timestamptz,
  start_at timestamptz,
  due_at timestamptz,
  is_all_day boolean default true,
  priority int default 0,                                  -- 0 none, 1 low, 3 med, 5 high
  position double precision default 0,
  rrule text,                                              -- iCal RRULE string for recurrence
  reminder_at timestamptz,
  estimated_pomodoros int default 0,
  spent_pomodoros int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists tasks_user_idx on tasks(user_id);
create index if not exists tasks_project_idx on tasks(project_id);
create index if not exists tasks_parent_idx on tasks(parent_id);
create index if not exists tasks_due_idx on tasks(due_at);

-- ---------- task_tags ----------
create table if not exists task_tags (
  task_id uuid references tasks(id) on delete cascade,
  tag_id uuid references tags(id) on delete cascade,
  primary key (task_id, tag_id)
);
create index if not exists task_tags_tag_idx on task_tags(tag_id);

-- ---------- habits ----------
create table if not exists habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon text default '🎯',
  color text default '#4772fa',
  goal_per_period int default 1,
  period text default 'day',          -- 'day' | 'week' | 'month'
  active_days int[] default '{0,1,2,3,4,5,6}',  -- 0=Sun..6=Sat
  reminder_time time,
  is_archived boolean default false,
  created_at timestamptz default now()
);
create index if not exists habits_user_idx on habits(user_id);

-- ---------- habit_logs ----------
create table if not exists habit_logs (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references habits(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  count int default 1,
  note text,
  created_at timestamptz default now(),
  unique (habit_id, log_date)
);
create index if not exists habit_logs_habit_date_idx on habit_logs(habit_id, log_date);

-- ---------- pomodoro_sessions ----------
create table if not exists pomodoro_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid references tasks(id) on delete set null,
  kind text default 'focus',         -- 'focus' | 'short_break' | 'long_break'
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_seconds int,
  completed boolean default false,
  created_at timestamptz default now()
);
create index if not exists pomodoro_sessions_user_started_idx on pomodoro_sessions(user_id, started_at);

-- ---------- updated_at trigger ----------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists projects_set_updated_at on projects;
create trigger projects_set_updated_at before update on projects
  for each row execute function set_updated_at();

drop trigger if exists tasks_set_updated_at on tasks;
create trigger tasks_set_updated_at before update on tasks
  for each row execute function set_updated_at();

drop trigger if exists profiles_set_updated_at on profiles;
create trigger profiles_set_updated_at before update on profiles
  for each row execute function set_updated_at();

-- ---------- on signup, create profile ----------
create or replace function handle_new_user() returns trigger as $$
begin
  insert into profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  -- create a default Inbox-equivalent project
  insert into projects (user_id, name, color, position)
  values (new.id, 'Personal', '#4772fa', 0);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- RLS ----------
alter table profiles enable row level security;
alter table projects enable row level security;
alter table tags enable row level security;
alter table tasks enable row level security;
alter table task_tags enable row level security;
alter table habits enable row level security;
alter table habit_logs enable row level security;
alter table pomodoro_sessions enable row level security;

-- profiles
drop policy if exists "profiles self read" on profiles;
create policy "profiles self read" on profiles for select using (auth.uid() = id);
drop policy if exists "profiles self upsert" on profiles;
create policy "profiles self upsert" on profiles for insert with check (auth.uid() = id);
drop policy if exists "profiles self update" on profiles;
create policy "profiles self update" on profiles for update using (auth.uid() = id);

-- generic owner policy macro per table
do $$
declare
  t text;
begin
  for t in select unnest(array['projects','tags','tasks','habits','habit_logs','pomodoro_sessions']) loop
    execute format('drop policy if exists "%1$s owner all" on %1$s', t);
    execute format($f$
      create policy "%1$s owner all" on %1$s
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id)
    $f$, t);
  end loop;
end$$;

-- task_tags: derive ownership from task
drop policy if exists "task_tags owner all" on task_tags;
create policy "task_tags owner all" on task_tags
  for all
  using (
    exists (select 1 from tasks t where t.id = task_tags.task_id and t.user_id = auth.uid())
  )
  with check (
    exists (select 1 from tasks t where t.id = task_tags.task_id and t.user_id = auth.uid())
  );

-- ---------- realtime ----------
-- Enable realtime publishing for the tables we want to subscribe to.
-- Idempotent: only adds if not already in the publication.
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'tasks','projects','tags','task_tags','habits','habit_logs','pomodoro_sessions'
  ]) loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end$$;
