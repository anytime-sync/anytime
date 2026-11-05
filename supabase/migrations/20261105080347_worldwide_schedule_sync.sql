-- PREPARED ONLY. No backfill, preference rewrite, or live migration execution.
-- Civil dates are authoritative for new explicit all-day intent. Compatibility
-- timestamps remain for older readers; unknown historical intent stays null.
alter table public.tasks
  add column start_date date,
  add column due_date date,
  add column schedule_timezone text,
  add column reminder_offset_min integer check (reminder_offset_min >= 0),
  add column calendar_id text,
  add column calendar_etag text,
  add column calendar_baseline jsonb,
  add column calendar_conflict jsonb,
  add column calendar_pending jsonb;

create index tasks_owned_calendar_mapping on public.tasks(user_id, calendar_event_id) where calendar_event_id is not null;

create or replace function public.mark_task_calendar_dirty() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (new.title, new.notes, new.start_at, new.due_at, new.start_date, new.due_date,
      new.schedule_timezone, new.is_all_day, new.time_kind, new.rrule,
      new.is_completed, new.status, new.parent_id)
    is distinct from
     (old.title, old.notes, old.start_at, old.due_at, old.start_date, old.due_date,
      old.schedule_timezone, old.is_all_day, old.time_kind, old.rrule,
      old.is_completed, old.status, old.parent_id) then
    new.calendar_dirty := true;
  end if;
  return new;
end $$;

-- A receipt makes retrying a lost completion response return the same result.
-- The task version, not the next occurrence, identifies the requested action.
create table public.task_completion_receipts (
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  expected_updated_at timestamptz not null,
  result jsonb not null,
  primary key (user_id, task_id, expected_updated_at)
);
create index task_completion_receipts_task on public.task_completion_receipts(task_id);
alter table public.task_completion_receipts enable row level security;
create policy completion_receipts_owner on public.task_completion_receipts
  for all to authenticated
  using (user_id = (select auth.uid()) and exists(select 1 from public.tasks where id=task_id))
  with check (user_id = (select auth.uid()) and exists(select 1 from public.tasks where id=task_id));
grant select, insert on public.task_completion_receipts to authenticated, service_role;

create function public.complete_task_occurrence(
  p_user_id uuid, p_task_id uuid, p_expected_updated_at timestamptz, p_next jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare current_task public.tasks; next_task public.tasks; receipt jsonb; done_at timestamptz := clock_timestamp();
  actor uuid := case when auth.role()='service_role' then p_user_id else auth.uid() end;
begin
  if p_expected_updated_at is null then raise exception 'completion_requires_revision'; end if;
  if actor is null then raise exception 'not_authorized'; end if;
  -- Existing task SELECT/UPDATE RLS governs owners and shared editors. The
  -- history belongs to the acting user, as in the previous UI completion path.
  select * into current_task from public.tasks where id=p_task_id and user_id=p_user_id for update;
  if not found then raise exception 'task_not_found'; end if;
  -- Resolve access and lock the current identity before returning a receipt.
  -- A concurrent worker may have committed the same request while we waited.
  select result into receipt from public.task_completion_receipts
    where user_id=actor and task_id=p_task_id and expected_updated_at=p_expected_updated_at;
  if found then return receipt; end if;
  if current_task.updated_at is distinct from p_expected_updated_at then raise exception 'task_changed'; end if;
  if current_task.is_completed then raise exception 'task_already_completed'; end if;
  if p_next is not null then
    next_task := jsonb_populate_record(current_task, p_next);
    insert into public.tasks(user_id, project_id, title, notes, priority, position, start_at, due_at,
      start_date, due_date, schedule_timezone, is_all_day, time_kind, status, is_completed, completed_at, rrule, calendar_event_id)
    values (actor, current_task.project_id, current_task.title, current_task.notes, current_task.priority, 0,
      current_task.start_at, current_task.due_at, current_task.start_date, current_task.due_date,
      current_task.schedule_timezone, current_task.is_all_day, current_task.time_kind, 'done', true, done_at, null, null);
    update public.tasks set start_at=next_task.start_at, due_at=next_task.due_at,
      start_date=next_task.start_date, due_date=next_task.due_date, schedule_timezone=next_task.schedule_timezone,
      reminder_at=next_task.reminder_at, reminder_sent_at=next_task.reminder_sent_at, rrule=next_task.rrule,
      is_completed=false, status='open', completed_at=null, updated_at=done_at
      where id=p_task_id and user_id=p_user_id returning * into next_task;
  else
    update public.tasks set status='done', is_completed=true, completed_at=done_at, updated_at=done_at
      where id=p_task_id and user_id=p_user_id returning * into next_task;
  end if;
  receipt := jsonb_build_object('data', to_jsonb(next_task), 'recurring', p_next is not null);
  insert into public.task_completion_receipts values (actor, p_task_id, p_expected_updated_at, receipt);
  return receipt;
end $$;
revoke all on function public.complete_task_occurrence(uuid,uuid,timestamptz,jsonb) from public, anon;
grant execute on function public.complete_task_occurrence(uuid,uuid,timestamptz,jsonb) to authenticated, service_role;

-- Only the server reconciler may apply remote fields and acknowledge them in
-- one transaction. A stale worker never overwrites an intervening local edit.
create function public.reconcile_task_calendar(
  p_user_id uuid, p_task_id uuid, p_expected_updated_at timestamptz,
  p_calendar_id text, p_event_id text, p_etag text, p_baseline jsonb, p_patch jsonb
) returns boolean language plpgsql security invoker set search_path = '' as $$
declare current_task public.tasks; incoming public.tasks;
begin
  select * into current_task from public.tasks where id=p_task_id and user_id=p_user_id for update;
  if not found or current_task.updated_at is distinct from p_expected_updated_at
    or current_task.calendar_event_id is distinct from p_event_id then return false; end if;
  if not exists(select 1 from public.user_calendar_connections where user_id=p_user_id and provider='google' and primary_calendar_id=p_calendar_id) then return false; end if;
  incoming := jsonb_populate_record(current_task, p_patch);
  update public.tasks set title=incoming.title, notes=incoming.notes,
    start_at=incoming.start_at, due_at=incoming.due_at, start_date=incoming.start_date, due_date=incoming.due_date,
    is_all_day=incoming.is_all_day, schedule_timezone=incoming.schedule_timezone,
    reminder_at=incoming.reminder_at, reminder_sent_at=incoming.reminder_sent_at
    where id=p_task_id and user_id=p_user_id;
  update public.tasks set calendar_id=p_calendar_id, calendar_etag=p_etag,
    calendar_baseline=p_baseline, calendar_conflict=null, calendar_pending=null, calendar_dirty=false
    where id=p_task_id and user_id=p_user_id;
  return true;
end $$;
revoke all on function public.reconcile_task_calendar(uuid,uuid,timestamptz,text,text,text,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.reconcile_task_calendar(uuid,uuid,timestamptz,text,text,text,jsonb,jsonb) to service_role;

-- Preserve the acknowledged revision before a native task is deleted. Existing
-- deletion queue/claim generations remain intact. Old rows without a baseline
-- require review; they cannot authorize overwriting a newer provider revision.
create table public.task_calendar_deletion_baselines (
  user_id uuid not null references auth.users(id) on delete cascade, event_id text not null, calendar_id text not null,
  task_id uuid not null, etag text not null, baseline jsonb not null,
  primary key(user_id, event_id)
);
alter table public.task_calendar_deletion_baselines enable row level security;
grant all on public.task_calendar_deletion_baselines to service_role;
create function public.save_task_calendar_deletion_baseline() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- During auth.users ON DELETE CASCADE the owner is already gone. Do not
  -- recreate a child row whose foreign key would block account deletion.
  if exists(select 1 from auth.users where id=old.user_id)
    and old.calendar_event_id is not null and old.calendar_id is not null and old.calendar_etag is not null and old.calendar_baseline is not null then
    insert into public.task_calendar_deletion_baselines values(old.user_id, old.calendar_event_id, old.calendar_id, old.id, old.calendar_etag, old.calendar_baseline)
      on conflict(user_id,event_id) do update set calendar_id=excluded.calendar_id, task_id=excluded.task_id, etag=excluded.etag, baseline=excluded.baseline;
  end if;
  return old;
end $$;
revoke all on function public.save_task_calendar_deletion_baseline() from public, anon, authenticated;
create trigger tasks_preserve_calendar_deletion before delete on public.tasks for each row execute function public.save_task_calendar_deletion_baseline();
