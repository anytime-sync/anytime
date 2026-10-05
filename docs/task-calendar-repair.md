# Task time intent and calendar repair

This change is based on verified `anytime-sync/anytime` main at
`055dd08e5e5f62f6fc661be1f2e2ca6b7a9cac66`. Unpublished desktop changes were
unavailable and were not used as implementation or validation evidence.

## Meaning of task dates

| `time_kind` | Task meaning | ICS and Google representation |
| --- | --- | --- |
| `deadline` | A commitment due at `due_at`; an optional `start_at` is availability, not occupied time | One transparent date marker at the deadline in the user's timezone. Exact timed deadline is retained in storage and included in the event description. A start-only task uses its start date. |
| `work` | Deliberately scheduled work, with a start and an end | An opaque timed event with exactly the supplied interval, including short, overnight, and multiday work. No duration cutoff or estimate-derived slot. |
| `span` | A date range including both endpoint dates | A transparent all-day range. The task's inclusive last date becomes the exclusive `DTEND`/Google `end.date`. |
| `null`/omitted (historical rows) | Intent was not recorded | Positive timed intervals are retained as work, positive all-day intervals as spans, and single/zero/inverted endpoints as deadline markers. Duration is never used to guess intent. |

A single clock time from Quick Add, inline input, Telegram, or the AI parser is a
deadline, not an invented 30-minute appointment. New two-endpoint input defaults
to work or a date span unless the caller explicitly specifies `deadline`.
The detail panel offers a calendar-meaning selector, date-only control, and
independent start/end editors. It does not write on open. Date picker drafts
apply explicitly; cancellation/dismissal discards them. Clear removes the field.

Changing one boundary through a reschedule preserves the exact duration of work
(and the inclusive civil-day count of a span, across daylight-saving changes).
Work intent is rejected unless the merged task has two valid endpoints with a
positive interval. Clearing an endpoint intentionally changes work to deadline;
explicitly requesting incomplete work fails before a database write. An
interrupted deadline → span → timed editor flow returns to deadline when an
endpoint is missing. Changing a boundary independently in the
detail editor sends both fields, so it can intentionally resize the interval.
Timeline and month dragging retain exact work duration; display minimum chip
height does not change stored dates. Snooze, deferral, reflection carry-forward,
and accepted AI slots no longer silently manufacture or cap intervals.

Recurrence completion shares one advancement helper across UI/API: deadlines
keep a missing start, work keeps its duration, and `COUNT` decreases instead of
restarting. Work/span recurrence is anchored to the start; deadlines to the due
date. Expansion uses the account's local civil time, independently of the host
timezone. Nonexistent spring-forward times are skipped. Completion history sets
both `status=done` and `is_completed=true`, so the existing status INSERT trigger
cannot turn the clone into an open task. It has no recurrence or event link.
Imported Google meetings remain in `calendar_events` and retain their
source intervals; task intent never reclassifies them. The bulk account importer
continues to import VTODO/CSV commitments as deadlines and does not import VEVENT
appointments into tasks.

## Export and Google synchronization

`projectTaskCalendar` provides both exports with the same date boundaries,
transparency, validated recurrence and deadline description. Civil date strings
are preserved as dates. API date-only input is converted to the user's local
midnight before timestamptz storage. For example, Taipei `2026-10-08` is stored as
`2026-10-07T16:00:00Z`, and exports as October 8 with an exclusive October 9 end.
Stable ICS identity remains `<task-id>@firstlight.to`. New Google event ids are
stable hashes of task ids plus a persisted `calendar_event_generation`, making
create retries idempotent when saving the link fails. Acknowledged deletion
increments the generation, so reopening/rescheduling creates a distinct id
instead of PATCHing a cancelled tombstone. Existing active event ids are retained.
A concurrent reopen or a conflicting cancelled generated id advances to the next
generation. Conflict recovery and linked writes verify `firstlightTaskId` before
changing an active event; cancelled resources are never restored. Unverified
appointments stay unchanged and the task/queue remains pending for review.
Date/dateTime fields are explicitly
cleared when switching event type; empty recurrence clears an old RRULE.

Recurring timed ICS events use `DTSTART;TZID=...` plus a matching `VTIMEZONE` and
an elapsed `DURATION`, so weekly 09:00 New York work remains at 09:00 across DST.
Google receives the same account timezone. Nonrecurring work stays in UTC.
The pinned `@touch4it/ical-timezones` dataset supplies ICS zone rules; these are a
snapshot, not live government timezone updates. New IANA zones missing from the
dataset return an explicit feed error instead of silently switching recurrence
to UTC. Historical pre-1970 rules and future legal timezone changes are not
guaranteed by that dataset; check/update it before supporting those cases.
ICS date-times have RFC 5545 second precision; storage, Google and work
rescheduling retain the original millisecond precision.

Google creation accepts either endpoint, including a date-only deadline or
start-only task. Linked edits use a persistent `calendar_dirty` flag instead of
a ten-minute timestamp window, so downtime does not lose updates. Successful
acknowledgement is scoped to the user's id and the exact `updated_at` version
sent; concurrent edits remain pending. Unscheduling, completion, archiving or
moving a linked task under a parent removes its generated event on the next
push. Creation, patching and both direct/queued deletion paths explicitly use
`sendUpdates=none`. The generic Google meeting transport retains its notification
defaults. Invalid persisted work intervals stay pending for review rather than
being interpreted as a removal request. A missing linked event is
reported for review rather than silently counted as synchronized.

## Migration and release review

`supabase/migrations/20261005140000_task_time_intent.sql` is PR-only. It adds a
nullable, constrained `time_kind`, `calendar_dirty` and a nonnegative
`calendar_event_generation` defaulting to zero, plus a SECURITY INVOKER
trigger and partial pending-update index. It changes no ownership/RLS policy.
Existing rows keep null intent, unchanged dates and `calendar_dirty=false`;
new rows default to dirty. It does not backfill intent or enqueue historical
Google events. Existing unlinked rows also wait for a calendar-affecting edit or
an explicitly approved targeted enqueue.

Apply this migration **before** releasing the application: the new queries and
writes need its columns. Deploying the code first will cause task/feed/sync query
errors. Older clients can omit the nullable field and still use existing
columns. Applications rolled back after the additive migration can ignore the
new columns; their old date-fabrication behavior would return. An old API client
must pass `time_kind=work` when converting an explicit deadline to scheduled work.
Changing a user's timezone does not automatically enqueue historical Google
projections; include those in a separately reviewed repair if needed.

**ICS rollout changes historical subscribed events immediately after polling.**
The migration's unchanged dates/null intent/dirty=false only prevent a Google
bulk enqueue. ICS has no dirty gate: application release runs every selected
historical row through the new projection and bumps `LAST-MODIFIED`. Compared
with base main, legacy positive timed intervals of 24 hours or longer and
multiday all-day intervals now retain their complete ranges instead of the old
single marker. Some are legitimate work; some may be fabricated lifecycle ranges.
This can increase crowding until reviewed per-id intent classification. No
duration heuristic can safely decide which is which. This PR does not claim
historical calendars stay visually unchanged or that the screenshot is fixed.

Before an approved release, inventory the affected subscribed ICS rows and
review ambiguous intent per id, while preserving actual appointments. Apply the
additive migration first, then any separately approved targeted classification,
then release the code and verify subscription refresh plus owned Google writes.
If verification fails, pause task sync before reverting application code; keep
the additive columns and original values for investigation. The prior binary
ignores the columns but restores its old date fabrication/export behavior, and
Google events already written will not be reversed by a code rollback. ICS can
revert on the next provider poll, subject to its cache; provider restoration and
any reversal of approved data changes require separate reviewed per-id actions.

The Supabase CLI could not initialize its read-only home configuration in this
cloud environment. The migration file was prepared directly and validated by
executing its actual SQL in a disposable PGlite PostgreSQL database. The committed
regression executes the existing `0021_api_compat.sql` task status trigger and the
new migration, checking old-row preservation, defaults, dirty-trigger behavior,
metadata/generation acknowledgements, date clearing, completed history and the
constraints. This is local SQL
validation, not validation against production policies or application of a
production migration.

## Historical event repair and source attribution

The reported orange iPhone events have not been attributed to a specific account
or calendar. The screenshot is not available in this environment, and no live
calendar rows, feed credentials or secrets were fetched. Code fixes do not prove
that those events came from First Light or that the screenshot is resolved.

After explicit production approval and identification of the calendar/account:

1. Capture a read-only task/event inventory and proposed per-id changes. Match
   owned events by existing link ids, `firstlightTaskId` and ICS UIDs; do not match
   by color/title alone or inspect/share secret feed URLs.
2. Review ambiguous historical intervals with the user. A 30-minute interval can
   be fabricated or legitimate, and a multiday interval can be scheduled work.
   Assign intent without altering real appointments or using a duration cutoff.
3. Apply only reviewed task intent changes and enqueue only corresponding owned
   Google events. Preserve existing identities; inspect date/time transitions and
   recurrence before any deletion. Back up original values for reversal.
4. Refresh the existing ICS subscription and allow the provider's polling/cache
   delay. Verify the identified October 8 calendar in Asia/Taipei. If those orange
   events belong to another publisher, repair that source separately.

No merge, deployment, production migration, live task update or calendar cleanup
is part of this draft PR.

## Validation in this cloud workspace

- `npm test`: 177 passing tests across 22 files, including mounted editor/picker
  behavior, lifecycle/ownership/notification regressions, independent ICS parsing
  across DST and execution of actual migration/status-trigger SQL in local PostgreSQL.
- The 49 schedule, API and ICS tests also pass with `TZ=Asia/Taipei`, while
  exercising New York DST semantics independent of the host timezone.
- `npm run typecheck` and `npm run lint`: passed; ESLint retains repository
  warnings in existing components.
- `npm run build --prefix firstlight-mcp`: passed; tracked distributable files
  were regenerated with the new task tool fields.
- Production `next build`: validated from an isolated source copy with dummy
  Supabase settings and no `.env` files. Direct Node font requests were blocked;
  real Google CSS/WOFF2 files were fetched with the environment's supported
  transport and cached via Next's font-response hook. No substitute font bytes
  or production data were used. This does not validate production integrations.
- Optional `npm run lint:i18n`: fails with the same 106 findings in 26 files as
  verified base main. New intent/draft-action labels have all five translations;
  translation parity tests pass.
