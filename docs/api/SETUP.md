# First Light public API — starter kit

Drop-in scaffolding for `firstlight.to/api/v1/*`, PAT auth, and the
Settings → API tokens UI. Pairs with `firstlight-mcp/` for the Claude /
OpenClaw integration.

## What's in this folder

```
firstlight-api/
├── supabase/migrations/0001_personal_access_tokens.sql
└── src/
    ├── lib/
    │   ├── pat.ts                       # mint / hash / validate / revoke
    │   └── plans-patch.md               # row to add to your plans.ts
    └── app/
        ├── api/
        │   ├── v1/
        │   │   ├── _lib/auth.ts         # bearer auth + plan gate + rate limit
        │   │   ├── tasks/
        │   │   │   ├── route.ts                  # GET, POST
        │   │   │   └── [id]/
        │   │   │       ├── route.ts              # GET, PATCH, DELETE
        │   │   │       └── complete/route.ts     # POST
        │   │   ├── events/
        │   │   │   ├── route.ts
        │   │   │   └── [id]/route.ts
        │   │   ├── notes/search/route.ts
        │   │   ├── daily/route.ts
        │   │   ├── daily-edition/route.ts
        │   │   └── goals/route.ts
        │   └── internal/
        │       └── api-tokens/                   # cookie-auth UI endpoints
        │           ├── route.ts
        │           └── [id]/route.ts
        └── settings/api-tokens/page.tsx          # mint / view / revoke UI
```

## Install in your repo

```bash
# from the root of the firstlight.to repo
cp -r ../path/to/firstlight-api/supabase/* supabase/
cp -r ../path/to/firstlight-api/src/* src/
```

Adjust imports if your repo uses different paths (`@/lib/...`,
`@/hooks/use-feature`, etc.).

## Migrate

```bash
supabase migration up   # or via MCP: apply_migration 0001_personal_access_tokens
```

You'll also need a small `api_request_log` table for the simple rate-limit
in `auth.ts`. If you don't want it, replace the body of `rateLimitOk()`
with `return true`. Schema:

```sql
create table public.api_request_log (
  id          bigserial primary key,
  user_id     uuid not null,
  method      text not null,
  path        text not null,
  created_at  timestamptz not null default now()
);
create index on public.api_request_log(user_id, created_at desc);
```

## Patch plans.ts

See `src/lib/plans-patch.md` — add an `apiAccess` row gated to `pro` / `vip`.

## Deploy

Just `git push` — Vercel rebuilds, `/api/v1/*` and `/settings/api-tokens`
are live. No env-var changes needed if Supabase is already wired up.

## Smoke test

```bash
# 1. Sign in, visit /settings/api-tokens, mint a token "smoke test"
# 2. Replace flp_live_... below and run:

curl -H "Authorization: Bearer flp_live_..." \
     https://firstlight.to/api/v1/daily

curl -H "Authorization: Bearer flp_live_..." \
     "https://firstlight.to/api/v1/tasks?limit=5"

curl -H "Authorization: Bearer flp_live_..." \
     -H "Content-Type: application/json" \
     -d '{"title":"created via API"}' \
     https://firstlight.to/api/v1/tasks
```

## Wire to OpenClaw

See sibling folder `firstlight-mcp/`. Once the API above is live:

```bash
cd firstlight-mcp
npm install
npm run build
npm link   # makes `firstlight-mcp` available globally
```

Register in OpenClaw config:

```json
{
  "mcpServers": {
    "firstlight": {
      "command": "firstlight-mcp",
      "env": {
        "FIRSTLIGHT_API_KEY": "flp_live_...",
        "FIRSTLIGHT_API_URL": "https://firstlight.to/api/v1"
      }
    }
  }
}
```

Restart OpenClaw. Ask it: "what's on my plate today" — it'll call
`daily_summary` and answer.

## Tweaks before going public

- Table/column names in `tasks`, `calendar_events`, `notes`, `goals`,
  `daily_editions` may differ slightly. Search for `// Adjust` comments
  and align.
- `match_notes` SQL function (referenced in `notes/search/route.ts`): if
  you're not already exposing one, add a thin wrapper around your
  existing Voyage semantic-search SQL.
- Rate-limit ceiling lives at the top of `auth.ts` (`RATE_LIMIT_PER_MIN`).
  Tier per plan if you want Plus → 30, Pro → 120, VIP → 600.
- `link_task_to_note` in the MCP server is a placeholder — once you add
  a dedicated `POST /api/v1/tasks/{id}/links` endpoint, swap the handler
  to call it.

## Security model recap

- Tokens are SHA-256-hashed at rest; only the first 8 chars of the raw
  token are stored as `token_prefix` for UI display.
- RLS on `personal_access_tokens` keeps users from seeing each others'
  tokens.
- `validate_pat()` SQL function is `SECURITY DEFINER` and only
  executable by `service_role` — the only path to look up by hash.
- Plan gate (`apiAccess`) is enforced on every request, not just at
  token mint, so downgrades take effect immediately.
- All `/api/v1/*` requests are logged in `api_request_log` for
  observability and rate-limiting.

