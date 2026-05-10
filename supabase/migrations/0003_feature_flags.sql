-- Round Z2: feature flag overrides
--
-- Lets an admin flip a feature's tier without a deploy. The static matrix in
-- src/lib/plans.ts is the default; rows in this table override it at runtime
-- (see src/lib/feature-flags.ts).
--
-- Apply with: supabase db push  (or paste into the SQL editor).

create table if not exists public.feature_flags (
  feature_id     text primary key,
  -- 'free' or 'pro' or 'team'. NULL means "use code default" (effectively no override).
  override_plan  text check (override_plan in ('free', 'pro', 'team')),
  -- Disable a feature entirely (returns false from any can-use check).
  disabled       boolean not null default false,
  -- Free-text note from the admin who flipped it.
  note           text,
  updated_at     timestamptz not null default now(),
  updated_by     uuid references auth.users(id) on delete set null
);

-- RLS: any authenticated user can read flags (the UI uses them); writes are
-- service-role only — the /api/admin/feature-flags route is the only writer
-- and it gates on ADMIN_EMAILS env.
alter table public.feature_flags enable row level security;

drop policy if exists feature_flags_select on public.feature_flags;
create policy feature_flags_select on public.feature_flags
  for select to authenticated using (true);

-- No insert/update/delete policy: service-role bypasses RLS.

-- Helper: bump updated_at on every write.
create or replace function public.feature_flags_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists feature_flags_touch on public.feature_flags;
create trigger feature_flags_touch
  before update on public.feature_flags
  for each row execute function public.feature_flags_touch_updated_at();
