-- Round Z3: manual plan overrides
--
-- Lets an admin force a user to a specific plan, independent of Stripe.
-- Useful for comping early adopters, beta testers, refunds, employees.
-- The user_plans view is updated to take this override over the
-- Stripe-derived plan (manual wins).

create table if not exists public.plan_overrides (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  plan        text not null check (plan in ('free', 'pro', 'team')),
  reason      text,
  set_by      uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- Optional expiration; once we pass this, the override is treated as gone.
  expires_at  timestamptz
);

alter table public.plan_overrides enable row level security;

drop policy if exists plan_overrides_self_read on public.plan_overrides;
create policy plan_overrides_self_read on public.plan_overrides
  for select to authenticated using (user_id = auth.uid());

-- Writes are service-role only — the /api/admin/users/[id]/plan route is
-- the only writer and it gates on ADMIN_EMAILS.

-- Touch updated_at on update.
create or replace function public.plan_overrides_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists plan_overrides_touch on public.plan_overrides;
create trigger plan_overrides_touch
  before update on public.plan_overrides
  for each row execute function public.plan_overrides_touch_updated_at();

-- Rebuild the user_plans view: manual override > active stripe sub > 'free'.
create or replace view public.user_plans as
select
  u.id as user_id,
  coalesce(
    case when po.expires_at is null or po.expires_at > now() then po.plan else null end,
    case when s.status in ('active', 'trialing', 'past_due') then s.plan else null end,
    'free'
  ) as plan,
  s.status as status,
  s.current_period_end as current_period_end,
  coalesce(s.cancel_at_period_end, false) as cancel_at_period_end,
  po.plan is not null and (po.expires_at is null or po.expires_at > now()) as is_manual_override,
  po.reason as override_reason,
  po.expires_at as override_expires_at
from auth.users u
left join public.subscriptions s on s.user_id = u.id
left join public.plan_overrides po on po.user_id = u.id;

-- Re-grant select on the view (RLS happens at the underlying tables).
grant select on public.user_plans to authenticated;
