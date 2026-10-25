# PR #26 release candidate

This is a review package, not authorization to merge, deploy, apply SQL or repair
customer calendars. Candidate changes are relative to main
`eae82d43076597a5257330e731c8e8363e4ecba0`. The branch keeps the original PR commits
and merges current main without rewriting history. The staged boundary supersedes the earlier candidate's legacy-inference release gate.
The exact tested head and CI
links belong in the PR description so this document cannot contain its own hash.

## Current evidence and preserved work

- Repository: `anytime-sync/anytime`; domain: `firstlight.to`.
- Read-only Vercel metadata identifies project
  `prj_AV53vMMkXiJRg9ecGMdFjwUEDpTf`, production deployment
  `dpl_7xpG32tiKshtjAmgWeDjtRyTZ6Sj`, and deployed commit `eae82d4`.
  Recheck this exact rollback target before an approved release.
- The reconciliation preserves current onboarding recovery, safe auth returns,
  task-first/product copy, retired hosted-AI guards/tool exclusions, task activity
  access labels, cron authentication and digest agenda changes. It does not
  replace shared-task RLS with owner-only task editing.
- Synthetic mounted editor regressions fail on an isolated copy of `eae82d4`
  (opening five malformed/incomplete or short fixtures and clearing a valid interval).
  They pass on the candidate, including a legitimate five-minute slot. This
  reproduces code behavior, not a real user's iPhone calendar.
- Current full local suite: 393 tests in 37 files. The 64 schedule/API/ICS/compatibility cases
  also pass with host timezone Asia/Taipei while exercising New York DST.
  Coverage includes missing endpoints, date-only/timed transitions, explicit
  apply/cancel, exact work duration, recurrence COUNT/UNTIL, all-day exclusive
  ends, ownership, notification suppression, cancellation/reopen generations,
  version acknowledgements, actual migration/status SQL and synthetic RLS.
- Build/test fixtures use dummy local settings, mocks and disposable PGlite.
  No credentials, customer-row reads, remote fixture writes, hosted preview
  tests or real iPhone acceptance tests are part of this reconciliation.

## Push and deployment boundary

`vercel.json` explicitly sets
`git.deploymentEnabled["codex/task-calendar-intent"] = false`, preserving the
three existing disabled branches. There is no matching true rule. According to
[Vercel's branch deployment configuration](https://vercel.com/docs/project-configuration/git-configuration#git.deploymentenabled),
this suppresses Git deployments from this branch. Existing GitHub workflows only
lint, typecheck, run synthetic tests, build and analyze source; they do not deploy.
Verify the remote head has not advanced before a normal fast-forward branch push,
and check Vercel's deployment list for the new SHA afterward. Do not retry by
removing the guard or changing hosting settings if delivery is blocked.

This guard is branch-specific. Merging into `main` would enable its normal
production deployment path. Merge, production release, staging/preview deployment,
database changes and any historical repair each require their own exact scope.

## Migration prerequisite

Target for a separately approved migration: Supabase **First Light** project
`mzrqjyvklehkzuyealxl`, never First Sight or another shared project.

File: `supabase/migrations/20261005140000_task_time_intent.sql`.
SHA-256: `14c98aee49263af4c96f72c6ab2485dffc62754fd38f457d6c337306a0e223aa`.

The read-only schema review found all three new columns absent. Tasks,
preferences and the deletion queue have RLS enabled. Existing task policies cover
ownership, project/group membership and assignment; preferences remain scoped to
the signed-in owner. Existing status, updated-at, group activity and task-delete
queue triggers are present. The migration adds no grant or policy and uses an
invoker dirty trigger with an empty search path. It leaves old dates and intent
unchanged, sets old rows dirty=false, new rows dirty=true and generation=0.

Before any approved application, recheck schema/migration history for concurrent
changes and back up the schema. Run `scripts/qa/task-calendar-preflight.sql` to
capture catalog metadata only. If any new column/constraint/function already
exists, stop and reconcile its definition; this one-shot migration is not a
blindly repeatable patch. Choose reviewed lock/statement timeouts and a window for
the index scan/table locks. Shared-database write contention affects other users.
Apply only this reviewed migration, before the new code. Do not run an unscoped
`db push` that could apply unrelated migrations or overwrite live policy changes.
Recheck the columns/defaults, invoker trigger, constraints/index and unchanged
RLS/policy definitions afterward. Local SQL success is not production acceptance.

## Conservative legacy compatibility boundary

Null/omitted intent keeps current-main `eae82d4` output until legitimately
classified. No deployment-time task update, duration-based intent inference or
bulk enqueue occurs. The compatibility tests import unmodified old-main ICS/date
source and compare complete output for long/short/all-day/single/zero/inverted
intervals, estimates, date-only values, recurrence and inactive rows in Taipei and
New York. Mixed feeds also keep legacy UTC recurrence unchanged alongside
explicit timezone-aware work. Legacy revision timestamps are not bumped.

The bounded duration/fallback rules remain only in the frozen legacy display
adapter. Unknown all-day/long ranges remain collapsed in ICS and ineligible for
Google writes as on main; an existing linked event is retained, not deleted by a
metadata edit. Enclosing-window feed selection is broadened only for explicit
intent. This closes the immediate re-expansion risk without discarding stored
endpoints or newly explicit legitimate long work/spans. Existing Google events
are not repaired merely by deploying this boundary.

New creation records intent from fresh supplied endpoints/date mode. A deliberate
due/availability edit on an unknown task records deadline intent without moving
its old availability start; a genuinely new pair can record work/span. An
unchanged copied endpoint cannot turn an old range into scheduled work. Explicit
selection enables work/span with valid endpoints regardless of duration. Opening,
cancelling, metadata edits and automatic recurrence do not classify a legacy row.
Future explicit completion/unscheduling retains the verified-owned-event removal
lifecycle. There is no requirement to classify historical rows before releasing
this conservative code fix.

Historical repair is still separate optional work: identify the calendar/account,
match owned ids/tags/UIDs and obtain a narrowly scoped inventory/classification or
cleanup authorization. No customer data classification, deletion or provider
repair is included, and no source is guessed from a title, color or duration.

## Separately approved rollout order

1. Reverify main/head, schema metadata, hosting project, backup and rollback
   deployment; approve exact migration and release scope. Keep legacy compatibility enabled.
2. Pause calendar write scheduling using an approved operational action. Apply
   the reviewed migration first and compare metadata/security snapshots. Account
   for writes from older clients during the transition; do not assume a read-only
   application window unless it has been explicitly arranged.
3. No historical classification/backfill is required. Build and
   release the tested application only after schema verification. Preview or
   staging testing against a shared database needs explicit fixture/access scope.
4. Verify synthetic/local checks again; then, with separate authorization, verify
   an isolated owned calendar/account, UID stability, notifications, exclusive
   date ends, recurrent local times and completion/reopen. Resume scheduling only
   after confirming the matching code/schema. Allow subscriber polling/cache time.

## Rollback and remaining limits

On a release failure, pause task sync first. Restore the verified pre-release
application deployment only with release authority; retain additive columns and
metadata for investigation. Old code ignores those columns but reintroduces the
old editor fabrication. Unknown projections already match the old release;
explicit intent would lose its corrected behavior on rollback. Do not drop columns while
new clients use them. A database rollback requires a separate backup/impact plan.

Google events already written are not reversed by an application rollback.
Restore only reviewed owned event/task ids from approved backups; account for the
generation/tombstone lifecycle and keep attendee notifications suppressed. ICS
can revert on a later provider poll, but caches can delay or retain old instances.
Changing subscription URLs, rotating feed tokens or deleting calendars is not a
generic repair procedure and is outside this scope.

Pinned ICS timezone data is a snapshot; new zones may produce an explicit feed
error, and historical/pre-1970 or future legal rule changes need a dataset review.
ICS has second precision; work storage/Google/rescheduling retain milliseconds.
These checks do not validate real provider state, live recurring exceptions,
an iPhone's cache, or the unidentified calendar shown in the earlier screenshot.
