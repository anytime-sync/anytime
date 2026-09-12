create table public.x_promotion_control (
 id integer primary key check (id = 1), enabled boolean not null default false,
 pause_reason text, lease_until timestamptz not null default '1970-01-01',
 last_tick_at timestamptz
);
insert into public.x_promotion_control(id) values (1);
alter table public.x_promotion_control enable row level security;
revoke all on public.x_promotion_control from public, anon, authenticated;
grant select, insert, update, delete on public.x_promotion_control to service_role;
create table public.x_promotion_queue (
 id uuid primary key default gen_random_uuid(),
 brand text not null check (brand in ('oqua','firstsight','firstlight')),
 slot integer not null check (slot between 1 and 3),
 body text not null check (char_length(body) between 10 and 560),
 body_hash text generated always as (md5(lower(regexp_replace(trim(body), '\s+', ' ', 'g')))) stored,
 scheduled_at timestamptz not null,
 local_day date generated always as ((scheduled_at at time zone 'Asia/Taipei')::date) stored,
 expires_at timestamptz not null,
 status text not null default 'queued' check (status in ('queued','sending','posted','failed','uncertain','skipped')),
 result_url text, error text, source_url text not null,
 created_at timestamptz not null default now(), attempted_at timestamptz, posted_at timestamptz,
 unique(brand,local_day,slot), unique(scheduled_at), unique(body_hash),
 check (expires_at > scheduled_at and expires_at <= scheduled_at + interval '90 minutes')
);
create index x_promotion_due on public.x_promotion_queue(scheduled_at) where status='queued';
alter table public.x_promotion_queue enable row level security;
revoke all on public.x_promotion_queue from public, anon, authenticated;
grant select, insert, update, delete on public.x_promotion_queue to service_role;
comment on table public.x_promotion_queue is 'Exclusive X publishing queue. Owner authorized three distinct posts per brand per Taipei day on September 12, 2026. Never automatically retry sending or uncertain rows.';
-- Keep legacy platform workers from publishing overlapping X campaigns.
-- Retain content and receipts; non-X queues are unchanged.
create function public.retire_legacy_x_pending() returns trigger
language plpgsql set search_path = '' as $$
begin
 if new.platform = 'x' and new.status = 'pending' then
   new.status := 'skipped';
   new.error := 'Superseded by owner-authorized x_promotion_queue; legacy X posting disabled 2026-09-12.';
 end if;
 return new;
end;
$$;
revoke all on function public.retire_legacy_x_pending() from public, anon, authenticated;
create trigger retire_legacy_x_pending before insert or update of status on public.social_queue
for each row execute function public.retire_legacy_x_pending();
update public.social_queue set status='skipped',
 error=concat_ws(E'\n',error,'Superseded by owner-authorized x_promotion_queue 2026-09-12; retained for review, no replay.')
where platform='x' and status='pending';
