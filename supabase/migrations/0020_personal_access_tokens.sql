-- ============================================================================
-- Personal Access Tokens (PATs) for the First Light public API.
--
-- Tokens are issued in the UI as `flp_live_<32 url-safe random chars>`.
-- Only the SHA-256 hash is persisted. The first 8 chars of the raw token
-- are also stored as `token_prefix` so the user can identify which token
-- is which in the UI without exposing the secret.
--
-- All access is enforced at two layers:
--   (1) RLS on this table (users see only their own tokens)
--   (2) The /api/v1/_lib/auth.ts middleware looks up the hash, joins
--       to auth.users, checks revoked_at / expires_at, and sets
--       request.user_id for downstream queries.
-- ============================================================================

create extension if not exists pgcrypto;

create table if not exists public.personal_access_tokens (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 80),
  token_hash    text not null unique,            -- sha256(raw_token), hex
  token_prefix  text not null,                   -- first 8 chars of raw token
  scopes        text[] not null default array['read','write']::text[],
  last_used_at  timestamptz,
  expires_at    timestamptz,                     -- null = never expires
  revoked_at    timestamptz,                     -- non-null = revoked
  created_at    timestamptz not null default now()
);

create index if not exists pat_user_idx        on public.personal_access_tokens(user_id);
create index if not exists pat_token_hash_idx  on public.personal_access_tokens(token_hash);
create index if not exists pat_active_idx      on public.personal_access_tokens(user_id)
  where revoked_at is null;

alter table public.personal_access_tokens enable row level security;

-- Users see / mint / delete only their own tokens.
create policy "pat select own"
  on public.personal_access_tokens for select
  using (auth.uid() = user_id);

create policy "pat insert own"
  on public.personal_access_tokens for insert
  with check (auth.uid() = user_id);

create policy "pat delete own"
  on public.personal_access_tokens for delete
  using (auth.uid() = user_id);

-- No public update policy: last_used_at is bumped via the security-definer
-- function below, called from the API auth middleware (service role).

-- ---------------------------------------------------------------------------
-- Validation function: called by /api/v1/_lib/auth.ts with the SHA-256 hash
-- of the bearer token. Returns the user_id + scopes if the token is active,
-- and atomically bumps last_used_at. Designed to be called by the service
-- role; safe to expose to authenticated as well.
-- ---------------------------------------------------------------------------
create or replace function public.validate_pat(p_hash text)
returns table (user_id uuid, scopes text[])
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.personal_access_tokens t
     set last_used_at = now()
   where t.token_hash = p_hash
     and t.revoked_at is null
     and (t.expires_at is null or t.expires_at > now())
  returning t.user_id, t.scopes;
end;
$$;

revoke all on function public.validate_pat(text) from public;
grant execute on function public.validate_pat(text) to service_role;

-- ---------------------------------------------------------------------------
-- Revoke function: lets an authenticated user revoke their own token from
-- the Settings UI without needing service-role privileges. Soft-delete so
-- audit trails survive.
-- ---------------------------------------------------------------------------
create or replace function public.revoke_pat(p_token_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.personal_access_tokens
     set revoked_at = now()
   where id = p_token_id
     and user_id = auth.uid()
     and revoked_at is null;
end;
$$;

revoke all on function public.revoke_pat(uuid) from public;
grant execute on function public.revoke_pat(uuid) to authenticated;

-- ============================================================================
-- api_request_log: simple per-user rate-limit + observability for /api/v1/*
-- Read in src/app/api/v1/_lib/auth.ts via rateLimitOk().
-- ============================================================================

create table if not exists public.api_request_log (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  method      text not null,
  path        text not null,
  created_at  timestamptz not null default now()
);

create index if not exists api_log_user_time_idx
  on public.api_request_log(user_id, created_at desc);

alter table public.api_request_log enable row level security;

-- Service role inserts these rows from /api/v1 routes. No client-side
-- read/write is needed; if you ever want to surface an audit page, add a
-- select policy at that point.


