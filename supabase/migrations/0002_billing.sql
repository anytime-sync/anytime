-- Round Z (billing): Stripe subscriptions, plan tiers.
--
-- One row per user. Free users have NO row in this table — absence of a row
-- means free tier. A Stripe webhook upserts a row on subscribe and updates
-- status on cancel / payment_failed / period_end roll-over.
--
-- Why a separate table (not columns on profiles):
--   - Stripe writes to it via service-role; users never write to it.
--   - Easier to extend later (Team plans, multiple subscriptions per user,
--     usage records, etc.) without bloating the profiles row.
create table if not exists public.subscriptions (
  user_id                 uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id      text not null,
  stripe_subscription_id  text not null,
  -- Single Pro tier today; columns leave room for "team", etc. later.
  plan                    text not null default 'pro' check (plan in ('pro', 'team')),
  -- Mirrors Stripe subscription.status exactly.
  -- "active" + "trialing" = treat as Pro.
  -- "past_due" = grace period; we still treat as Pro so a payment retry
  --              doesn't yank features mid-day. Keep at app's discretion.
  -- "canceled" / "unpaid" / "incomplete_expired" = downgrade to free.
  status                  text not null check (status in (
    'active','trialing','past_due','canceled','unpaid',
    'incomplete','incomplete_expired','paused'
  )),
  current_period_end      timestamptz,
  cancel_at_period_end    boolean not null default false,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists subscriptions_customer_idx
  on public.subscriptions(stripe_customer_id);

-- A user looking up their own row is fine. Writes go through the webhook
-- using service-role, so users cannot self-grant Pro.
alter table public.subscriptions enable row level security;

create policy "subscriptions_self_select"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- updated_at touch trigger (mirrors how other tables in this schema do it).
create or replace function public.subscriptions_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists subscriptions_touch_updated_at on public.subscriptions;
create trigger subscriptions_touch_updated_at
  before update on public.subscriptions
  for each row execute function public.subscriptions_touch_updated_at();

-- Helper view: "what plan does this user have right now?"
-- Returns 'pro' for active/trialing/past_due Stripe rows; 'free' otherwise.
-- The app calls this via RLS-gated select so each user only sees their own row.
create or replace view public.user_plans as
  select
    u.id as user_id,
    coalesce(
      case
        when s.status in ('active','trialing','past_due') then s.plan
        else null
      end,
      'free'
    ) as plan,
    s.status,
    s.current_period_end,
    s.cancel_at_period_end
  from auth.users u
  left join public.subscriptions s on s.user_id = u.id;

grant select on public.user_plans to authenticated;
