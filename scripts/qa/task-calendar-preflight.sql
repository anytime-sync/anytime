-- Read-only schema/policy preflight for PR #26. No task/event/customer rows.
-- Capture before migration and compare after the separately approved change.
begin transaction read only;

select table_name,column_name,data_type,is_nullable,column_default
from information_schema.columns
where table_schema='public' and table_name='tasks'
  and column_name in ('time_kind','calendar_dirty','calendar_event_generation')
order by ordinal_position;

select c.relname,c.relrowsecurity,p.polname,p.polcmd,p.polroles,
  pg_get_expr(p.polqual,p.polrelid) as using_expression,
  pg_get_expr(p.polwithcheck,p.polrelid) as check_expression
from pg_class c join pg_namespace n on n.oid=c.relnamespace
left join pg_policy p on p.polrelid=c.oid
where n.nspname='public'
  and c.relname in ('tasks','user_preferences','pending_calendar_deletions')
order by c.relname,p.polname;

select t.tgname,pg_get_triggerdef(t.oid) as definition
from pg_trigger t where t.tgrelid='public.tasks'::regclass and not t.tgisinternal
order by t.tgname;

select p.proname,p.prosecdef as security_definer,p.proconfig
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname='mark_task_calendar_dirty';

select conname,pg_get_constraintdef(oid) as definition
from pg_constraint where conrelid='public.tasks'::regclass
  and conname in ('tasks_time_kind_check','tasks_calendar_event_generation_check')
order by conname;

select indexname,indexdef from pg_indexes
where schemaname='public' and tablename='tasks' and indexname='tasks_calendar_dirty_idx';

rollback;
