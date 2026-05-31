-- API compatibility layer (2026-05-31)
--
-- The public REST API in src/app/api/v1/* references columns and a table
-- that don't exist in the live schema:
--
--   tasks.status          → DB has is_completed (bool) instead
--   daily_editions.date   → DB has edition_date
--   daily_editions.title  → DB has headline
--   daily_editions.body   → DB has front_page
--   daily_editions.sections → not in DB (split: kicker/inside/below_fold)
--   goals                 → table doesn't exist
--   calendar_events.all_day          → DB has is_all_day
--   calendar_events.external_provider → DB has provider
--   calendar_events.task_id           → didn't exist
--
-- This migration adds the columns the API expects WITHOUT breaking the
-- existing app frontend (which uses is_completed, edition_date, etc.).
-- Read-only aliases are trigger-maintained so we don't depend on the
-- generated-column immutability rules. tasks.status <-> is_completed are
-- two-way synced via trigger.

-- ===== tasks.status =====
alter table public.tasks add column if not exists status text;

update public.tasks
  set status = case when coalesce(is_completed, false) then 'done' else 'open' end
  where status is null;

alter table public.tasks alter column status set default 'open';
alter table public.tasks alter column status set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tasks_status_check') then
    alter table public.tasks add constraint tasks_status_check
      check (status in ('open','done','archived'));
  end if;
end$$;

create index if not exists tasks_status_idx on public.tasks(status);

create or replace function public.tasks_sync_status_completed()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.status is null then
      new.status := case when coalesce(new.is_completed, false) then 'done' else 'open' end;
    end if;
    new.is_completed := (new.status = 'done');
    if new.status = 'done' and new.completed_at is null then
      new.completed_at := now();
    elsif new.status <> 'done' then
      new.completed_at := null;
    end if;
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      new.is_completed := (new.status = 'done');
      if new.status = 'done' and new.completed_at is null then
        new.completed_at := now();
      elsif new.status <> 'done' then
        new.completed_at := null;
      end if;
    elsif new.is_completed is distinct from old.is_completed then
      new.status := case when coalesce(new.is_completed, false) then 'done' else 'open' end;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_sync_status on public.tasks;
create trigger tasks_sync_status before insert or update on public.tasks
  for each row execute function public.tasks_sync_status_completed();

-- ===== goals table =====
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'active' check (status in ('active','paused','done','archived')),
  target_date date,
  progress_pct integer default 0 check (progress_pct between 0 and 100),
  linked_task_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists goals_user_idx on public.goals(user_id);
create index if not exists goals_status_idx on public.goals(status);

alter table public.goals enable row level security;
drop policy if exists own_goals on public.goals;
create policy own_goals on public.goals for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists goals_set_updated_at on public.goals;
create trigger goals_set_updated_at before update on public.goals
  for each row execute function public.set_updated_at();

-- ===== daily_editions read-aliases (trigger-maintained) =====
alter table public.daily_editions add column if not exists "date" date;
alter table public.daily_editions add column if not exists title text;
alter table public.daily_editions add column if not exists body text;
alter table public.daily_editions add column if not exists sections jsonb;

update public.daily_editions
  set "date" = edition_date,
      title = headline,
      body = front_page,
      sections = jsonb_build_object('kicker', kicker, 'inside', inside, 'below_fold', below_fold)
  where ("date" is null and edition_date is not null)
     or (title is null and headline is not null)
     or (body is null and front_page is not null)
     or sections is null;

create or replace function public.daily_editions_sync_aliases()
returns trigger language plpgsql as $$
begin
  new."date" := new.edition_date;
  new.title := new.headline;
  new.body := new.front_page;
  new.sections := jsonb_build_object(
    'kicker', new.kicker,
    'inside', new.inside,
    'below_fold', new.below_fold
  );
  return new;
end;
$$;

drop trigger if exists daily_editions_sync_aliases_trg on public.daily_editions;
create trigger daily_editions_sync_aliases_trg
  before insert or update on public.daily_editions
  for each row execute function public.daily_editions_sync_aliases();

-- ===== calendar_events aliases =====
alter table public.calendar_events
  add column if not exists all_day boolean generated always as (is_all_day) stored;
alter table public.calendar_events
  add column if not exists external_provider text generated always as (provider) stored;
alter table public.calendar_events
  add column if not exists task_id uuid references public.tasks(id) on delete set null;
create index if not exists calendar_events_task_idx on public.calendar_events(task_id);

-- Tell PostgREST to reload its schema cache so the new columns/table are visible
notify pgrst, 'reload schema';
