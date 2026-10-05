-- Review/apply separately before deploying the corresponding application.
-- Null intent preserves old clients/rows; no duration-based historical backfill.
alter table public.tasks add column time_kind text;
alter table public.tasks add constraint tasks_time_kind_check
  check (time_kind is null or time_kind in ('deadline', 'work', 'span'));

-- Existing linked events are deliberately NOT queued for mass repair.
alter table public.tasks add column calendar_dirty boolean not null default false;
alter table public.tasks alter column calendar_dirty set default true;

-- A deleted Google id can remain a tombstone. Each acknowledged removal
-- advances the identity generation; retries of the same generation are stable.
alter table public.tasks add column calendar_event_generation integer not null default 0
  check (calendar_event_generation >= 0);

create function public.mark_task_calendar_dirty() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if row(new.title, new.notes, new.start_at, new.due_at, new.is_all_day,
         new.time_kind, new.rrule, new.is_completed, new.status, new.parent_id)
     is distinct from
     row(old.title, old.notes, old.start_at, old.due_at, old.is_all_day,
         old.time_kind, old.rrule, old.is_completed, old.status, old.parent_id) then
    new.calendar_dirty := true;
  end if;
  return new;
end;
$$;
create trigger tasks_calendar_dirty before update on public.tasks
  for each row execute function public.mark_task_calendar_dirty();

create index tasks_calendar_dirty_idx on public.tasks (user_id, updated_at)
  where calendar_dirty and calendar_event_id is not null;
