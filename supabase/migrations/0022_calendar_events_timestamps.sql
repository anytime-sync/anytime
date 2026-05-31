-- The API selects calendar_events.created_at and .updated_at, but the
-- existing table tracks recency via fetched_at only. Add both columns and
-- backfill from fetched_at so nothing returns null on the first read.

alter table public.calendar_events
  add column if not exists created_at timestamptz default now();
alter table public.calendar_events
  add column if not exists updated_at timestamptz default now();

update public.calendar_events
  set created_at = coalesce(created_at, fetched_at, now()),
      updated_at = coalesce(updated_at, fetched_at, now())
  where created_at is null or updated_at is null;

drop trigger if exists calendar_events_set_updated_at on public.calendar_events;
create trigger calendar_events_set_updated_at before update on public.calendar_events
  for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';
