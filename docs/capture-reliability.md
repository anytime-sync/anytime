# Account-day membership and reliable task capture

This is a new local reconstruction of three retained behavior contracts against
`dfa303b3864ab37b23c1a0fd36332f3b14ab82a8` (PR35). The original October 26 patch,
manifest and test artifacts were unavailable through the checked surfaces.
This implementation does not claim to restore their bytes or historical test
results. All reproductions use synthetic fixtures; none establishes a verified
production incident.

## Calendar contract

Today and Tomorrow smart-list membership follows the stored account timezone,
using the same `dayWindow` civil-day boundaries as the daily digest. A day starts
inclusively at local midnight and ends exclusively at the next local midnight;
it is not assumed to contain 24 hours. Missing or invalid account zones use the
existing digest's UTC fallback. Initial timezone synchronization still preserves
an existing stored zone when the device travels, and refreshes preferences after
initializing an absent zone.

The list waits for the preference read. A failed preference read is surfaced as
an error instead of silently substituting the device zone. Cache keys contain the
account date and zone, and an open view refreshes at account midnight or focus.
Next 7/90 days, list date buckets and calendar-event membership within these same
smart lists use the shared boundaries so that the page agrees with its heading.
Today inline capture's implicit all-day default is the account day's start.

Existing overdue membership and task due/start precedence are preserved: Today
also includes overdue dated tasks, and an explicit due date takes precedence over
start-only fallback. Tomorrow excludes the prior day's overdue tasks. This does
not alter digest selection, recurrence or calendar synchronization. It is a
smart-list membership contract, not a conversion of every date editor, natural
language date parser, timestamp label or timeline to account-local wall time.

## Durable task and metadata contract

Once the task INSERT returns its saved row, a later tag or task-tag write failure
is partial success. The confirmed task replaces its optimistic row and remains
visible. Capture closes/clears normally and reports “Task saved. Tags couldn't be
saved.” with the task title, requested tags and a persistent **Retry tags** action.
That action only retries metadata for the confirmed task ID; it never inserts a
task. Repeated clicks are serialized. Successful recovery removes the retry
action and refreshes task/tag caches.

Tags use the existing `(user_id, name)` unique key and links use the existing
`(task_id, tag_id)` primary key with duplicate-ignore upsert. This makes repeated
metadata recovery safe even when a tag/link write committed but its response was
lost. No migration or schema change is required. A failed initial task INSERT
removes only its own optimistic row, preserving unrelated captures in the cache.

Recovery intent lives in the current page's notification. Reload preserves the
saved task but discards pending tag names and the retry action; the user can add
tags in the existing task editor. This does not introduce durable recovery or an
idempotency guarantee when the initial task INSERT itself commits but its response
is lost. Automatic mutation retry is disabled for that initial INSERT.

## Explicit list contract

Both Quick Add and inline capture resolve a parsed explicit list name before
inserting a task, with hosted AI disabled. Existing lists match case-insensitively;
a missing list is created first. A pending/failed list read or failed list creation
prevents task insertion and retains the entire raw draft, including title, date,
tags and list text. An already-created list enters the query cache immediately so
a subsequent task failure can be retried without creating that list again.

While a task capture is pending, repeated submit is ignored and the input stays
read-only. Quick Add also prevents closing or replacing the pending draft via its
own controls. On confirmed task success, the draft is cleared/closed. Ordinary
blank input and cancellation before submit remain write-free. Unsaved drafts are
not persisted across page reload/navigation/remount. There is no new cross-tab
list-name uniqueness constraint or guarantee for a lost list-INSERT response.
Hosted AI, calendar-event creation and other capture surfaces are unchanged.

## Local regression checks

- `npm test -- --maxWorkers=2 --minWorkers=1`: full unit suite, including real
  React Query capture-hook tests and both real capture components with mocks.
- `npm run test:smoke`: existing calendar/digest regression suite.
- `npm run test:capture`: Chromium, real capture components/queries/Supabase
  request serialization, synthetic PostgREST and auth. All external browser
  traffic and unexpected APIs are blocked. Unrelated task rendering/dragging,
  voice, scan and action-brief components are fixtures. This is not an RLS or
  production-auth test.
- `npm run test:onboarding`: existing isolated onboarding/Insights browser checks.
- `npm run typecheck`, `npm run lint`, and isolated `npm run build` with fixture
  service settings and no `.env` files. The review bundle records exact results,
  source hashes, commands and any genuine-font cache workaround.

The browser scripts need Chromium and `playwright-core`, as does the existing
onboarding script. In the managed QA runtime, set `NODE_PATH` to its preinstalled
Node dependency directory; no dependency installation is part of this patch.

## Future release decision

The proposed branch is `codex/firstlight-capture-reliability-20261103`. Its exact
`git.deploymentEnabled` entry is `false` in `vercel.json`, preserving all existing
branch guards and cron definitions. Before any separately authorized future push,
verify the branch name matches this guard and that no matching enabled pattern or
separate deployment integration overrides it. Unspecified Vercel branches deploy
by default. Existing GitHub workflows run checks on PRs into main/develop and
build on main/develop pushes; they contain no explicit Vercel deploy command.
The guard does not disable main deployment. Push, PR creation, merge and release
remain separate future decisions; none is performed by this local work.
