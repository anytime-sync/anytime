begin;
-- Apply this exact new migration only after reviewing schema/history parity.
-- The earlier time-intent migration has a differently recorded hosted version;
-- do not replay it or repair migration history as part of this migration.
do $$ begin
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='tasks' and column_name='time_kind')
    or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='tasks' and column_name='calendar_event_generation')
    or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='tasks' and column_name='calendar_dirty')
    or not exists(select 1 from pg_catalog.pg_trigger where tgrelid='public.tasks'::regclass and tgname='tasks_calendar_dirty' and not tgisinternal)
    or to_regprocedure('public.mark_task_calendar_dirty()') is null then
    raise exception 'worldwide_schedule_requires_reviewed_time_intent_schema';
  end if;
end $$;
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

-- Keep trusted synchronization state out of owner/shared-client writes. RLS
-- still governs native task fields. current_user is the database role, not a
-- client-settable request setting. The server uses the service_role grant.
create function public.guard_task_schedule_state() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op='INSERT' then
      if new.calendar_event_id is not null or new.calendar_event_generation<>0
        or new.calendar_id is not null or new.calendar_etag is not null
        or new.calendar_baseline is not null or new.calendar_conflict is not null
        or new.calendar_pending is not null or not new.calendar_dirty then
        raise exception 'calendar_state_is_server_managed';
      end if;
    elsif new.id is distinct from old.id or new.user_id is distinct from old.user_id then
      raise exception 'task_identity_is_immutable';
    elsif (new.calendar_event_id,new.calendar_event_generation,new.calendar_id,new.calendar_etag,
      new.calendar_baseline,new.calendar_conflict,new.calendar_pending,new.calendar_dirty)
      is distinct from (old.calendar_event_id,old.calendar_event_generation,old.calendar_id,old.calendar_etag,
      old.calendar_baseline,old.calendar_conflict,old.calendar_pending,old.calendar_dirty) then
      raise exception 'calendar_state_is_server_managed';
    end if;
  end if;
  -- Do not guess a civil date from an old client's timestamp-only edit.
  -- Updated clients supply the canonical date and compatibility instant together.
  if new.start_date is not null or new.due_date is not null then
    if new.schedule_timezone is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=new.schedule_timezone) then
      raise exception 'civil_date_requires_timezone' using errcode='23514';
    end if;
    if not coalesce(new.is_all_day,false) and new.time_kind is distinct from 'span' then
      raise exception 'civil_date_requires_date_intent' using errcode='23514';
    end if;
    if (new.start_date is not null and (new.start_at at time zone new.schedule_timezone)::date is distinct from new.start_date)
      or (new.due_date is not null and (new.due_at at time zone new.schedule_timezone)::date is distinct from new.due_date) then
      raise exception 'civil_date_changed_use_current_client' using errcode='23514';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.guard_task_schedule_state() from public, anon, authenticated;
-- Runs before tasks_calendar_dirty; a native edit may then mark itself dirty.
create trigger tasks_aaa_schedule_guard before insert or update on public.tasks
for each row execute function public.guard_task_schedule_state();

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
revoke all on public.task_completion_receipts from public, anon, authenticated;
grant select on public.task_completion_receipts to authenticated;
grant all on public.task_completion_receipts to service_role;

create function public.complete_task_occurrence(
  p_user_id uuid, p_task_id uuid, p_expected_updated_at timestamptz, p_next jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare current_task public.tasks; next_task public.tasks; receipt jsonb; done_at timestamptz := clock_timestamp();
  actor uuid := case when auth.role()='service_role' then p_user_id else auth.uid() end;
begin
  if p_expected_updated_at is null then raise exception 'completion_requires_revision'; end if;
  if actor is null or coalesce(auth.role(),'') not in ('authenticated','service_role') then raise exception 'not_authorized'; end if;
  -- Definer is needed only for protected receipts. Repeat the existing task
  -- UPDATE authorization (0002 + 0024); future policy changes must update this
  -- guard together. The history belongs to the acting user, as before.
  select * into current_task from public.tasks where id=p_task_id and user_id=p_user_id for update;
  if not found then raise exception 'task_not_found'; end if;
  if auth.role()<>'service_role' and not (
    current_task.user_id=actor
    or (current_task.project_id is not null and public.is_project_member(current_task.project_id))
    or (current_task.share_group_id is not null and public.is_share_group_member(current_task.share_group_id))
  ) then raise exception 'task_not_found'; end if;
  -- Resolve access and lock the current identity before returning a receipt.
  -- A concurrent worker may have committed the same request while we waited.
  select result into receipt from public.task_completion_receipts
    where user_id=actor and task_id=p_task_id and expected_updated_at=p_expected_updated_at;
  if found then return receipt; end if;
  if current_task.updated_at is distinct from p_expected_updated_at then raise exception 'task_changed'; end if;
  if current_task.is_completed then raise exception 'task_already_completed'; end if;
  if p_next is not null then
    if nullif(current_task.rrule,'') is null then raise exception 'task_not_recurring'; end if;
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
revoke all on public.task_calendar_deletion_baselines from public, anon, authenticated;
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

commit;
