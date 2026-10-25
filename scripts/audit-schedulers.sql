-- Read-only aggregate snapshots. Run statements separately with existing
-- authorized access. No tokens, recipient addresses, titles or live RPC calls.
select now() as observed_at, count(*) as google_connections,
  max(last_sync_at) as latest_checkpoint, min(last_sync_at) as oldest_checkpoint,
  count(*) filter(where last_sync_at is null or last_sync_at < now()-interval '15 minutes') as stale_over_15m
from public.user_calendar_connections where provider='google';

select now() as observed_at, count(*) as pending_deletions,
  count(*) filter(where attempts>1) as retried,
  count(*) filter(where last_error is not null) as with_error,
  max(attempts) as max_attempts, min(created_at) as oldest_pending
from public.pending_calendar_deletions;

select now() as observed_at, max(sent_at) as last_recorded_send,
  count(*) filter(where sent_at>=now()-interval '24 hours') as recorded_sends_24h,
  count(*) filter(where email_id is null) as missing_provider_reference
from public.daily_digest_log;

-- Uses CURRENT opt-in/timezone/hour. Missing rows are investigation candidates,
-- not proven missed deliveries: preferences may have changed after send time.
with eligible as (
  select p.user_id, (now() at time zone coalesce(z.name,'UTC'))::date as local_date
  from public.user_preferences p left join pg_timezone_names z on z.name=p.timezone
  where p.email_daily_digest
    and extract(hour from now() at time zone coalesce(z.name,'UTC')) > coalesce(p.digest_send_hour,7)
    and exists(select 1 from public.profiles r where r.id=p.user_id and r.email is not null)
)
select now() as observed_at, count(*) as current_opt_ins_past_send_hour,
  count(*) filter(where not exists(select 1 from public.daily_digest_log l
    where l.user_id=e.user_id and l.sent_for_date=e.local_date)) as missing_current_local_day_log
from eligible e;
