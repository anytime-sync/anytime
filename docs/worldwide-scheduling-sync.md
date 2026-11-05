# Account timezone and task/calendar synchronization

Local candidate based on PR36 (`b7768165ef126c331c259b538cfa0824dca25f9e`).
This extends the earlier capture contract in `capture-reliability.md`; its
historical scope and validation counts describe PR36, not this candidate.
Reproductions here use synthetic data. They do not establish production incidents
or constitute Google, iPhone, email-delivery, or production acceptance.

## Time semantics

- The stored account IANA zone controls application civil days, calendar grids,
  task labels, capture parsing, date/reminder editing, snooze and drag operations.
  Device and server zones are independent. Missing/invalid preferences retain the
  existing UTC fallback; failed preference reads block scheduling writes. Initial
  device-zone adoption uses a conditional database write and duplicate-ignore
  insertion, so a stale device cannot overwrite a confirmed preference.
- New explicit date-only commitments use `start_date`/`due_date`. These civil
  values remain unchanged when the account zone changes. Timestamp columns remain
  compatibility mirrors; timestamps alone never prove that midnight means all-day.
  Existing unknown `time_kind` remains unknown until an explicit scheduling edit.
- Timed commitments are absolute instants. Displaying them in another zone does
  not change storage. An explicit drag/reschedule preserves account wall time and
  elapsed work duration. Day windows are half-open, using calendar arithmetic;
  DST days may have 23, 25, 23.5 or 24.5 hours.
- New ambiguous or nonexistent local date-times are rejected with an explanation.
  The user must choose another time or provide an explicit offset through a
  supported text/API input. The picker does not silently choose a fold offset.
  An unchanged picker Apply preserves the exact original instant and precision.
- New schedules retain `schedule_timezone`; recurring wall time follows that
  saved zone even after an account-zone change. Recurrence skips gaps and chooses
  the earlier fold occurrence. COUNT decreases only for a completed real
  occurrence. Invalid rules or resolution errors do not mean exhaustion.
- Relative reminders retain their offset and follow rescheduling and the actual
  next occurrence. Editing an absolute reminder clears the relative offset.
  Existing absolute reminders are not inferred to be relative.
- Calendar month/day/week views use native task identity. Today/Tomorrow retain
  the established due/start precedence and overdue semantics; this does not
  redefine a task span as due on every day it occupies in Calendar. Midnight and
  focus refresh share one clock per active account zone.

New nullable columns are not backfilled. Older classified recurring tasks without
a saved series zone still fall back to the current account zone. Unclassified
recurrence retains the existing UTC compatibility behavior. Historical intent
cannot safely be reconstructed from interval length or midnight timestamps.

## Google representation and conflict contract

Google all-day `start.date` and exclusive `end.date` are canonical. An absent end
means the following civil date. Task span ends remain inclusive and are converted
at the provider boundary. One serializer handles POST, PATCH and inbound mirrors,
so immediate and reloaded canonical dates agree independently of server timezone.
Raw DATE values drive membership after travel, rather than old compatibility
timestamps. ICS export includes each recurring series' own timezone definition.

Native mirrors retain stable Google IDs and deletion generations. New
`calendar_id`, `calendar_etag` and `calendar_baseline` fields record the last
acknowledged provider projection. The baseline includes only fields First Light
writes. JSONB key order is irrelevant to comparison. A pending write fingerprint
supports recovering a lost create/PATCH response without discarding later edits.

Inbound may update the same native task only when the stored event mapping,
calendar connection and private task tag agree. An arbitrary tag is not authority.
A one-sided Google edit can update title/notes, an explicit work interval, or an
explicit civil deadline/span. Exact echoes are idempotent. An old mapping without
a baseline may be acknowledged only when the complete owned projection matches.
Otherwise it becomes a review conflict. Conflict snapshots contain only event
identity, revision and status, so shared task readers do not receive provider-only
attendees, locations or private properties. Local edits during provider I/O remain
dirty because acknowledgement requires the exact original `updated_at` revision.

PATCH and DELETE use If-Match. Fetching a new ETag does not permit overwriting
changes since the persisted baseline. A 412 refetches and either recognizes an
identical acknowledged result or records a conflict; it never blindly retries a
write. Task mirror writes retain `sendUpdates: none`. Direct external-event
editing requires the revision the user reviewed and refreshes a complete cached
revision after a 412. An instance revision cannot authorize editing its series.

Expanded recurring instances are compared with their verified master and
`originalStartTime`. Ordinary instances do not move the series task to an
occurrence date. Changed/cancelled occurrences are explicit persistent conflicts;
later ordinary/master echoes cannot erase them. Native completion/deletion is
never inferred from Google cancellation. Unsupported intent, recurrence, series
zone and timed-deadline date/description changes also require review.

Sync now runs inbound, outbound and owned deletion retries independently, reports
failures, remaining actionable work and conflicts, and refreshes task/detail/
subtask/calendar caches even after partial success. It does not call an empty
inbound response a complete two-way sync. Inbound advances its checkpoint only
after every fetched page is persisted and its connection revision still matches.
A bounded 410 reset never authorizes deletion by absence. It retains the previous
checkpoint on failure; an old event outside the reset window is not declared gone.

## Atomic recurring completion and migration boundary

`20261105080347_worldwide_schedule_sync.sql` is prepared only. No connected,
hosted, production or user-data database was changed. Its SQL is exercised in an
ephemeral local PGlite database with synthetic roles, tables and task rows.

Both UI and API recurring completion call `complete_task_occurrence`. A task lock,
exact expected revision, history insertion, advancement and retry receipt live in
one transaction. An insert failure rolls back the advancement. The API requires
`expected_updated_at` (or If-Unmodified-Since) for recurring completion; retry the
same revision after a lost response. The protected completion function explicitly
checks the existing owner/assignee/project/share-group editing rules, including
assignee-only tasks with a different owner and no group membership. Assignment is
checked on the locked current row before receipt access; a former assignee cannot
reuse an earlier receipt after reassignment. A NULL assignee never grants access.
History and receipts belong to the actor, preserving the previous UI history
ownership. Receipts cascade with task/account deletion. Both the snapshot trigger
and the existing queue trigger skip an already-deleted owner during an account
cascade. The exact supplied queue trigger/FK interaction is tested in PGlite;
group-activity and other hosted cascade combinations have the limits below.

The server-only reconciliation RPC applies remote task fields and acknowledges
the baseline atomically under an exact revision and owned connection check.
A deletion trigger snapshots acknowledged provider state before native deletion,
without replacing the existing queue/claim mechanism. Snapshot cleanup follows
confirmed provider deletion. Legacy queued deletions without a baseline remain
pending for review. No existing queued customer row was inspected or changed.

The new application code requires the additive schema. Deployment before a
separately approved migration would fail; there is deliberately no fallback to
non-atomic writes or unprotected provider overwrites. PGlite acceptance does not
verify every hosted schema extension, trigger combination, auth integration,
concurrent PostgreSQL connection or production RLS policy combination.

## Import policy

VTODO import respects IANA TZID, UTC and VALUE=DATE. Todoist TIMEZONE resolves
floating input in the source zone. Generic/TickTick imports require a civil date
or an explicit timestamp offset. Floating input without a source zone, custom
unsupported zones, gaps/folds, VEVENT-only files and recurring VTODOs are rejected
before inserting tasks rather than silently losing time or recurrence intent.
This does not make existing multi-batch imports transactional.

## Explicit scope and release limits

- This is conservative bidirectional reconciliation for supported linked native
  tasks, not complete synchronization of every Google field or occurrence edit.
  Settings includes an owner-only pending/conflict list and comparison. Supported
  nonrecurring classified changes can explicitly use the reviewed Google version
  for the same native task. The POST refetches and checks the review digest
  (task revision, acknowledged baseline/ETag, projection and remote ETag), then
  applies through the atomic exact-revision RPC. It never writes to Google.
  Newer remote edits after that read remain available to the next inbound sync.
  There is no force-local overwrite action. Recurring exceptions, legacy/missing
  baselines, deleted events, mode changes and unsupported deadline edits retain
  the task/conflict and explain why manual review is required. No Google Tasks connector or OAuth scopes were added.
- Email and Telegram capture use the same account IANA parser and canonical
  date fields as Quick Add. Invalid/absent preferences use explicit UTC; preference
  read failures block capture. New DST gaps/folds reject capture without saving
  an unscheduled substitute. The account parser validates Chrono components as
  civil values before applying IANA resolution: host-local DST must not discard
  the date phrase first. Explicit offset timestamps retain their instant precision.
  This uses the [documented Chrono refinement API](https://github.com/wanasit/chrono#customize-chrono),
  with no dependency patch or host timezone mutation. Telegram completion uses the listed exact revision
  and common atomic occurrence command; list numbering matches the cached order.
- Digest/Telegram windows use civil dates first, half-open instant windows and
  overlap for explicit work; civil span ends are inclusive. Explicit work ending
  at day start is excluded from that day's agenda and is overdue. Start-only
  deadlines are included. Unknown historical intent stays on its legacy due-point
  contract; durations do not classify it. Digest send logs and caps are unchanged.
- Digest, reminder email and Telegram share date rendering: canonical civil dates
  stay fixed, timed values render in the account zone, explicit midnight stays
  timed. A pinned schedule zone different from the account zone is shown as
  `(account: <zone>; schedule: <zone>)`. Digest canonical Google DATE fields take
  precedence over compatibility timestamps; older rows retain their UTC-prefix
  compatibility interpretation. No history is backfilled.
- Reminder dispatch reads timezone and the existing push opt-out, fails closed on
  a failed preference query, and does not invent times for date-only tasks. Browser
  timers are keyed by reminder instant/title/revision, cancelled on removal or
  unmount, and refreshed after native/remote edits and focus/resume. Delays remain
  absolute instant differences. Existing email/push shared claim policy is unchanged;
  no live notification or email acceptance has occurred.
- The day/week rails retain their existing display range and wall-clock layout.
  A repeated DST hour may share a visual position; stored instants remain distinct.
  This is not mobile/touch/iPhone or complete timeline UX acceptance.
- PR36 task/tag recovery remains page-local. A lost initial native task INSERT
  response is still uncertain. Direct external Google event POST also lacks the
  native mirror's stable task ID recovery guarantee. Neither case is claimed
  idempotent by this change. No paid hosted AI was restored.
- PR26 intent/export behavior, PR34 digest range rendering and PR35 privacy are
  preserved. Dependency versions are unchanged. Prior Security CI masked npm
  audit's nonzero exit (41 vulnerabilities: 4 low, 22 moderate, 12 high, 3 critical);
  this work does not establish a clean vulnerability audit.

The local branch is `codex/firstlight-timezone-sync-20261105`. Its exact
`git.deploymentEnabled` entry is false; all seven prior guards and cron definitions
are preserved. The repository's two workflows have no explicit deploy command.
A future push/PR, migration and release each need new authority and refreshed
deployment checks. This guard does not prove that independent automation is
impossible. Previously denied Vercel webhook enumeration was not retried.

## Reproducible local checks

- Full unit suite and existing `npm run test:smoke` calendar/digest checks.
- Relevant timezone, PR26 compatibility, ICS, import and editor tests under
  `TZ=UTC`, `TZ=Asia/Taipei` and `TZ=America/Los_Angeles`.
- `scripts/qa/capture-reliability.cjs`, `onboarding.cjs` and
  `worldwide-calendar.cjs` and `calendar-review.cjs`: real UI/query code with synthetic auth/PostgREST;
  external and unexpected browser requests are blocked.
- Typecheck, lint and an isolated production build with fixture service values,
  no `.env` files, genuine Google Fonts and no disabled production check.

Provider/database fixtures cover lost responses, overlapping workers, edits
during push, exact echoes, baseline drift, 429/5xx, 412, ownership, instance/master
identity, paginated partial failure and 410 reset. Full hosted-provider and
concurrent-database acceptance remains a future release requirement.

## Migration review and rollback order

The prepared migration remains `20261105080347_worldwide_schedule_sync.sql` and
is **not applied** to any hosted/connected database. It runs in one transaction
and fails preflight when the prerequisite time-intent/assignee columns, dirty
function/trigger, or restricted queue function/attached AFTER DELETE trigger are
missing or incompatible. The coordinator's permitted read-only catalog check
confirmed hosted version **`20261025013129`, name `task_time_intent`**; the
repository file remains `20261005140000_task_time_intent.sql`. Do not replay,
rename, or repair that history. Only the exact reviewed new migration is proposed.
The same bounded metadata check confirmed the listed runtime columns (including
`push_reminders`), existing time-intent checks/index, status/dirty/updated-at
triggers, `calendar_events` uniqueness on `(user_id,provider,external_id)` and
digest-log primary key `(user_id,sent_for_date)`. These supplied catalog facts are
not live behavior or complete release acceptance; this worker made no hosted read.

`guard_task_schedule_state` is an invoker trigger with an empty search path. It
rejects authenticated/anonymous writes to mapping, generation, acknowledged
baseline/ETag, pending/conflict and dirty state before the native dirty trigger.
It also rejects task identity/owner changes. Native shared-task edits keep existing
RLS. Server writers use service_role. Existing civil dates must agree with the
compatibility timestamp's date in the saved schedule zone; this deliberately
allows within-day legacy end-of-day timestamps and midnight DST transitions.
A cross-day timestamp-only old-client edit fails with
`civil_date_changed_use_current_client`; updated clients send both fields. New
helpers still emit account-day starts. Old rows without civil intent are untouched.

Completion is a narrowly scoped definer with empty search path, qualified names,
explicit signed actor-role checks and the existing owner/assignee/project/share-group
editing rules. A task lock and exact revision guard precede receipt access. History,
advancement and receipt commit together. Authenticated clients may SELECT their
accessible receipts but cannot insert/update/delete/truncate them. Future changes
to shared-task authorization must update this explicit function guard too.
Reconciliation stays service-only/invoker and checks owned connection, mapping and
exact task revision. Baseline/outbox/conflict state is durable and not exposed as
provider snapshots to shared readers. The restricted deletion snapshot trigger
preserves the acknowledged revision and skips accounts already being cascaded.
Deletes require that acknowledged ETag, including provider-only changes.

The proposed replacement of `queue_calendar_event_delete()` adds only the
owner-existence guard to its supplied body. It retains SECURITY DEFINER,
`search_path = public, pg_catalog`, the existing AFTER DELETE trigger, and the
existing postgres/service_role execution ACL. PGlite compares the function/trigger
identities, owner, ACL and security configuration before and after replacement.
Normal linked-task deletion still enqueues. The queue remains owner-editable
under existing RLS; its fields cannot authorize a provider deletion without the
separate service-only acknowledged snapshot and matching mapping/ETag/baseline.

The old queue body creates a row referencing a deleted `auth.users` parent and
therefore blocks the reproduced non-group account cascade **before** this
migration. This is an inherited defect, not one introduced by the snapshot table.
The earlier checkpoint fixture omitted that AFTER trigger; the expanded fixture
reproduces the failure, then verifies both triggers together after the fix.
The supplied group-activity metadata is modeled only for its DELETE branch:
ordinary shared-task deletion logs activity, but a synthetic ordering in which
the group has already disappeared fails the group-activity FK. The full hosted
function, group/account dependency ordering, INSERT/UPDATE activity branches and
all other trigger interactions are not reproduced. No group-activity function or
policy is changed, and this result is not a complete hosted account-deletion proof.

Rollback is **application first, additive state retained**: stop the new sync /
completion callers through an approved release operation, roll the application
back to a compatible checkpoint, and retain civil columns, baselines, outbox,
conflicts, receipts, ACLs and protective triggers, including the inherited queue
cascade fix. The original PR36 client may
receive explicit errors when editing already-civil dates; it cannot safely own
those new schedules. Do not drop columns/tables to obtain apparent compatibility.
A destructive schema rollback would require a separately approved backup and
conversion/ambiguity plan. Dependency order, if ever approved, is callers → RPCs
and task-attached triggers → receipts/deletion snapshots/indexes → replacement
of the dirty trigger body → new columns. That destructive rollback is not prepared
for automatic execution and has not been claimed tested.

SQL verification uses synthetic ephemeral PGlite, including production-shaped
`now()` revision triggers, owner/shared/assignee/former-assignee/unrelated actors,
receipt forgery, metadata forgery, old-client rejection, transaction failure/retry,
normal linked deletion, queue tampering and the bounded cascade interactions above.
This is not full hosted RLS/extension/trigger parity or multi-connection/provider
acceptance.
