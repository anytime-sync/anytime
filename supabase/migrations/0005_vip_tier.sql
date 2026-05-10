-- Round Z4: VIP tier
--
-- VIP is an admin-grant of Pro-level access *without* Stripe payment. Useful
-- for friends, family, employees, beta users, and journalists. The user
-- themselves sees no "VIP" label — they appear as Pro to themselves and to
-- the rest of the app. Only the owner can grant VIP via /app/admin/members.
--
-- Mechanically: VIP is a plan_overrides row with plan='vip'. Anywhere we ask
-- "is this user pro?", we accept vip as well (vip rank == pro rank).

-- 1) Allow 'vip' in the override constraint.
alter table public.plan_overrides drop constraint if exists plan_overrides_plan_check;
alter table public.plan_overrides
  add constraint plan_overrides_plan_check
  check (plan in ('free', 'pro', 'vip', 'team'));

-- 2) Rebuild the user_plans view so VIP behaves identically to Pro for the
--    user's own consumption (settings UI, plan gates), but the admin can
--    still tell which is which by the underlying plan_overrides row.
--
--    The 'plan' column the user reads is mapped: vip → pro. The
--    'is_manual_override' flag remains true so the admin UI can decorate
--    VIP-comped users.
create or replace view public.user_plans as
select
  u.id as user_id,
  coalesce(
    case
      when po.expires_at is null or po.expires_at > now()
        then case when po.plan = 'vip' then 'pro' else po.plan end
      else null
    end,
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

grant select on public.user_plans to authenticated;
