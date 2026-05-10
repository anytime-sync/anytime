-- Round Z5: editable landing-page content
--
-- One JSON blob, one row. The owner edits this from /app/admin/design and the
-- /pricing + /app/features pages render with code defaults as fallback.
-- Public can read (so /pricing works for anonymous visitors). Only the owner
-- can write.

create table if not exists public.landing_config (
  id          int primary key default 1,
  config      jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) on delete set null
);

-- Seed the singleton row.
insert into public.landing_config (id, config) values (1, '{}'::jsonb)
  on conflict (id) do nothing;

-- Anyone can read — the table holds public marketing copy, not user data.
alter table public.landing_config enable row level security;

drop policy if exists landing_config_public_read on public.landing_config;
create policy landing_config_public_read on public.landing_config
  for select to anon, authenticated using (true);

-- No insert/update/delete policy — service-role bypasses RLS and is the only
-- writer. The /api/admin/landing-config route gates writes on isOwner.

-- Touch updated_at on every write.
create or replace function public.landing_config_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists landing_config_touch on public.landing_config;
create trigger landing_config_touch
  before update on public.landing_config
  for each row execute function public.landing_config_touch_updated_at();

grant select on public.landing_config to anon, authenticated;
