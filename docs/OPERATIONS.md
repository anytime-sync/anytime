# FirstLight cloud operating workflow

Repository inspected 2026-10-18 at main `4ed85b3`; PR #30 (calendar agenda in digest) is merged. Use the existing GitHub PRs/CI, Vercel schedules and Supabase tables. [BACKLOG.md](BACKLOG.md) is the small queue; reuse existing issues/PRs.

## Task and release lifecycle

1. **Ready:** write a user-visible acceptance criterion, observed evidence, affected journey and safe reproduction. Check open PRs before implementation. #26 already owns durable calendar write retries/time intent; #23 contains broader onboarding/activation changes.
2. **In progress:** use this saved cloud checkout, activate `/workspace/.cloud-setup/activate.sh`, and branch from main. Keep one active project task. Fixtures must not load service-role/Google/Resend credentials or call live cron routes.
3. **Draft / verified:** attach exact commands, results, commit, limitations and rollback plan. A failing production-evidence check stays open even if fixtures pass. This phase's Today change reuses #23's minimal list-view modal insertion; reconcile that overlapping hunk before merging either PR. It does not import #23's redesign or instrumentation.
4. **Release approved:** Aaron explicitly approves exact commit/target, migration order if any, merge and release. A merge to main can trigger Vercel. This phase creates draft PRs only and introduces no database migration.
5. **Observed / done:** after an approved release, observe the next existing scheduled invocation and its per-account domain outcome. Record deployment commit and evidence. Reopen the same task if criteria fail; propose rollback before executing it.

At the start of each engineering session, review CI/open PRs and read-only scheduler evidence, then pick the highest incomplete criterion. End with verified changes, remaining gaps and the next concrete action. No new scheduled automation is established by this cadence.

The phase-one branch has `git.deploymentEnabled["codex/cloud-ops-phase1-20261018"] = false`; its pushes must not deploy previews. Other branch behavior is preserved. Add a branch-specific guard before any future unapproved push; [Vercel documents the setting](https://vercel.com/docs/project-configuration/git-configuration).

## Isolated verification

```sh
source /workspace/.cloud-setup/activate.sh
npm run test:smoke
npm test -- --maxWorkers=2 --minWorkers=1
npm run typecheck
npm run lint
npm run test:onboarding
```

Smoke selects the existing calendar sync/write, authentication, agenda and digest suites plus the route-orchestration and honest-metric regressions. Providers and data are fixtures. The calendar route smoke checks drain ordering, per-account failures, unavailable tokens and continuation. Digest tests exercise the real query builder against intercepted fixture HTTP, local-day/DST windows, pagination, tenant isolation and email HTML/text. No mail is sent.

`test:onboarding` uses this saved cloud runtime's `playwright-core` and Chromium (`PW_EXE`), plus esbuild already provided by Vitest. It bundles the real Today page, view-mode hook, welcome modal and UI store, fixtures unrelated panels/data hooks, blocks external browser traffic, and uses fresh contexts. It covers default list and stored timeline, both dismissal controls, two simulated logout/login remounts, switching views and reload. It does **not** prove real authentication, production rendering, cross-device behavior or task writes. No extra browser dependency/service is installed by this change.

The welcome flag remains per-browser `fl.onboardingSeen`, not per-account. The default-list failure was reproduced in Chromium before the one-line fix; the existing two-choice welcome is preserved. Cohort retention is not recoverable from current task `updated_at`. Insights now labels bounded rolling counts of existing task rows; repeated edits count once, automated edits count, and failed counts show **Unavailable**, not zero. No profile denominator or invented percentages remain.

CI already runs lint, typecheck, tests and build; its push-only job repeats the build. Existing Security checks include non-blocking dependency commands, so a green Security run alone is not a clean dependency audit. Main [CI run](https://github.com/anytime-sync/anytime/actions/runs/38996421782) passed before this phase. This work does not add another CI or scheduler system.

## Scheduler evidence and recovery

Use the read-only statements in [scripts/audit-schedulers.sql](../scripts/audit-schedulers.sql) through existing authorized Supabase access. Retain aggregate counts/timestamps privately. Never select tokens, email addresses, task/event text, or invoke mutation RPCs/cron handlers for an audit.

| Flow | Current evidence | Retry / deduplication limits |
| --- | --- | --- |
| Calendar, `*/5 * * * *` | A recent successful import checkpoint was observed on Oct 18. Full invocation history is unavailable (Vercel log 403); a checkpoint proves neither outbound success nor no missed runs. | Stable `(user_id,provider,external_id)` upsert, bounded full sync after expired token, checkpoint failures propagated. Handler can return HTTP 200 with failed accounts. Outbound dirty-state/idempotency work belongs to existing #26. |
| Calendar deletion queue | Read-only audit found old entries at the retry ceiling with errors. | Existing claim RPC/attempt state must be reviewed before replay. Do not delete/reset/retry live entries to make the queue look healthy. Prepare a per-item repair proposal after ownership/error classification. |
| Digest, `0 * * * *` | Recent `daily_digest_log` records include Oct 18 local dates. The delegated handoff verifies Oct 18 delivery. Actual calendar-event inclusion is **pending the existing Oct 20 scheduled digest**. | Account-local configured hour, log PK `(user_id,sent_for_date)`. Read-then-send-then-insert is not atomic; concurrent runs or successful sends with failed log insertion can duplicate mail. No provider idempotency key. Failed sends are eligible again only during that local hour; no later catch-up is implemented. |

For each audit record observed-at, explicit UTC window, configured cadence, last domain success, slot coverage/misses, partial failures, retry backlog and deduplication limits. A checkpoint is a latest-state signal, not a historical ledger. The current-preferences missing-digest query is a **candidate gap** check: preferences/timezones may have changed after the send hour; it is not a historical eligibility reconstruction. A delivery log confirms recorded provider acceptance, not inbox delivery or rendered calendar content.

Vercel runtime-log reads for `firstlight` were denied (403); the saved environment has no authenticated Vercel CLI fallback. Closing that gap requires an approved read-only export or connector repair confined to project/log access. Do not alter access or save new credentials here. Vercel does not automatically retry a failed cron request ([cron documentation](https://vercel.com/docs/cron-jobs/manage-cron-jobs)); do not assume retries because the handler is idempotent in a sequential fixture.

Other existing definitions: hourly `/api/cron/x-promotion` and `/api/reminders/dispatch`, daily 08:00 UTC `/api/admin/keywords/reclassify`, and every 15 minutes `/api/cron/embeddings-sync`. Their last-success/missed-run history is **not audited by this phase**. `/api/cron/daily-editions` exists in source but is not listed in `vercel.json`; this is not authorization to schedule it. The weekly GitHub Security schedule is a code scan, not application operations evidence.

## Measurement boundaries

`src/lib/track.ts` intentionally does nothing. Its call sites are not measured activation. Vercel Analytics/Speed Insights packages exist, but analytics reads in the associated review returned 403; no baseline was obtained. Package presence/absence cannot establish all external instrumentation. The separately inspected empty PostHog Default project is not a pipeline and no collection setup is approved. Keep experiment candidates in the backlog until definitions, consent/access and a real baseline are approved.
