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
same revision after a lost response. Existing task RLS governs owner/shared-editor
access. History and receipts belong to the actor, preserving the previous UI
history ownership. Receipts cascade with task/account deletion. The snapshot trigger skips an
already-deleted account during cascading deletion; this is tested in PGlite.

The server-only reconciliation RPC applies remote task fields and acknowledges
the baseline atomically under an exact revision and owned connection check.
A deletion trigger snapshots acknowledged provider state before native deletion,
without replacing the existing queue/claim mechanism. Snapshot cleanup follows
confirmed provider deletion. Legacy queued deletions without a baseline remain
pending for review. No existing queued customer row was inspected or changed.

The new application code requires the additive schema. Deployment before a
separately approved migration would fail; there is deliberately no fallback to
non-atomic writes or unprotected provider overwrites. PGlite acceptance does not
verify every hosted schema extension, existing queue trigger, auth integration,
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
  Conflict review is surfaced; a general choose-local/choose-remote resolution UI
  is not implemented. Recurring exception conflicts need a separately reviewed
  resolution workflow. No Google Tasks connector or OAuth scopes were added.
- Date entry and Calendar views are covered here. Email ingestion and Telegram
  command/query formatting still have separate timezone paths (email omits an
  account parser context; Telegram uses Taipei). Digest selection and other
  downstream readers still use compatibility timestamps rather than new civil
  columns. Those paths need review before a claim of worldwide correctness across
  every channel, especially after an explicit account-zone change. No digest
  selection, live recurrence repair or private-row diagnosis is included.
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
  `worldwide-calendar.cjs`: real UI/query code with synthetic auth/PostgREST;
  external and unexpected browser requests are blocked.
- Typecheck, lint and an isolated production build with fixture service values,
  no `.env` files, genuine Google Fonts and no disabled production check.

Provider/database fixtures cover lost responses, overlapping workers, edits
during push, exact echoes, baseline drift, 429/5xx, 412, ownership, instance/master
identity, paginated partial failure and 410 reset. Full hosted-provider and
concurrent-database acceptance remains a future release requirement.
