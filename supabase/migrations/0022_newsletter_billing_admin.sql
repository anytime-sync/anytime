-- Newsletter broadcasts table
create table if not exists public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  body_html text not null default '',
  body_text text not null default '',
  audience text not null default 'all' check (audience in ('all', 'free', 'plus', 'pro')),
  status text not null default 'draft' check (status in ('draft', 'sending', 'sent', 'failed')),
  sent_count integer,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

alter table public.broadcasts enable row level security;

-- Only admin can read/write broadcasts (via service role in API)
-- No direct user access needed

-- Admin plan distribution RPC for billing dashboard
create or replace function public.admin_plan_distribution()
returns table(plan text, count bigint)
language sql
security definer
as $$
  select
    coalesce(up.plan, 'free') as plan,
    count(*) as count
  from profiles p
  left join user_plans up on up.user_id = p.id
  group by coalesce(up.plan, 'free')
  order by count desc;
$$;

-- In-app announcements (banners)
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  link_url text,
  link_text text,
  style text not null default 'accent' check (style in ('info', 'success', 'warning', 'accent')),
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  target_plans text[],
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.announcements enable row level security;

-- All authenticated users can read active announcements
create policy "Anyone can read active announcements" on public.announcements
  for select using (active = true and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()));

-- Email broadcast opt-in preference (default true — users can opt out)
alter table user_preferences
  add column if not exists email_broadcasts boolean not null default true;
