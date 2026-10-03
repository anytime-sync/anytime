# First Light logic review — 2026-10-03

Reviewed main commit 8be3c077b84f821c4307166cd6ebf9106860e589. Targeted source review of tasks UI/API, iCalendar export, Google read/write sync and authentication callback. This is not a full security audit or proof of live production behavior.

## Fixes in this branch

- API pagination followed UUID order while returning deadline/creation order. Continuation now follows deadline ascending (null last), creation descending, UUID ascending, preserving the existing UUID cursor interface and owner scoping. List responses now expose rrule.
- Null/array POST bodies and unexpected priority value types could throw. Guard them before accessing properties or string methods.
- Missing completion targets returned database errors. Use an optional single-row lookup to return 404.
- Failed recurring-history inserts were ignored by the completion API. Stop before advancing when the insert fails. This is a partial safeguard, not transactionality.
- Archived tasks leaked into the iCalendar feed. Exclude them in both query and serialization.
- All-day iCalendar events commonly emitted the same DTSTART and DTEND calendar date. Ensure a minimum exclusive next-day end; retain explicit multi-day ends.
- Calendar line folding counted JavaScript characters rather than UTF-8 octets, potentially breaking Chinese/emoji text. Fold on code-point boundaries and keep physical lines <=75 bytes including continuation space.
- Expired Google sync-token recovery reused undefined bootstrap bounds. Recompute bounded request parameters after switching to full sync.
- Page-cap truncation and checkpoint-write errors falsely returned success. Return explicit errors without marking incomplete pages as synced.

## Remaining priorities

### P1: Atomic recurring completion and finite recurrence

Files: src/hooks/use-tasks.ts, src/app/api/v1/tasks/[id]/complete/route.ts.
Both re-anchor DTSTART to current due_at each completion. FREQ=DAILY;COUNT=2 therefore starts a fresh two-occurrence series every time and never exhausts. Invalid rules are also treated like exhausted rules and silently completed. Historical insert and live-row advancement are separate requests; concurrent completion or a later update failure can duplicate history, lose a completed occurrence, or advance twice. The UI ignores Supabase's returned insert error and launches history writing independently of advancing.

Recommended fix: one owner-scoped transactional database operation, row lock, occurrence identifier/idempotency check, immutable recurrence anchor or an explicit remaining-count field, explicit invalid-rule errors, and one common UI/API completion path. Preserve tags, parent/project links and reminder offsets. Test concurrency, retry, COUNT/UNTIL exhaustion, timezone and daylight-saving transitions before rollout.

### P1: Durable Google Calendar write queue

File: src/lib/calendar-write.ts.
PATCH selects only tasks updated in the last ten minutes. Edits made during an outage older than that window are permanently missed. CREATE ignores a failed database write of calendar_event_id, allowing repeated external creates. Concurrent workers can create duplicates; a 404 PATCH is represented as cancelled by the transport but counted as patched. Archived and completed tasks are not excluded from new creates. Completion history clones retain timestamps and can be pushed as extra meetings. Clearing task dates or archiving a linked task does not enqueue cancellation (only hard DELETE does).

Recommended fix: persistent outbox or calendar_pushed_at/version tracking, worker claim/lease, deterministic external event IDs, explicit retry state, and defined archive/completion behavior. Avoid removing existing calendar events until the desired product semantics are confirmed. Current branch fixes the separate iCalendar feed, not Google write lifecycle.

### P2: Schedule and all-day consistency

Files: src/app/api/v1/tasks/route.ts, src/hooks/use-tasks.ts, src/lib/calendar-write.ts, src/lib/icalendar.ts.
Creation differs by path: API invents a 30-minute block and can silently move a supplied deadline, while UI uses equal start/due. API date-only input can become a timed work block; fractional midnight is inconsistently recognized. Google all-day event builder can emit equal start/end dates. All-day exports derive dates in UTC rather than an explicit user timezone, risking an off-by-one date for local-midnight timestamps. Use one schedule validator and define stored all-day calendar dates/timezone before migration.

### P2: Auth, rate limits and recovery

src/app/auth/callback/route.ts ignores exchangeCodeForSession errors and redirects as if login succeeded; malformed next values can throw before fallback. Add explicit failed-exchange routing with safe diagnostic codes.

src/app/api/v1/_lib/auth.ts counts then asynchronously logs requests, making rate limiting fail-open on storage errors and non-atomic under concurrency. Use an atomic rate-limit primitive if API abuse becomes material.

Expired Google sync-token recovery does not remove stale locally cached events; a bounded resync can leave old cancelled/deleted events. Design a generation-based reconciliation rather than blanket deletion in a recovery request. A page-limit error now reports truthfully, but calendars above the cap still require durable pagination continuation.

## Validation

81 tests pass across 16 files; TypeScript passes. New tests cover all-day exclusive ends, Chinese/emoji folding, archived export exclusion, token-reset bounds, truncated sync, checkpoint errors, malformed inputs, cursor filters and history-insert failures. No live calendar writes, production migrations, or credential changes were performed. Integration behavior against live Google/ICS clients and PostgREST remains to be verified after deployment.

## Screenshot follow-up — multi-day stretching

Legacy recurring task records can retain old starts after due-only reschedules. The export now normalizes stale timed ranges into a bounded deadline slot; calendar subscription refresh timing is controlled by the subscriber.

Added regression fixes: apply the existing task-range normalization to timed iCalendar and Google event exports; stale ranges >=24h use a short deadline slot rather than an occupied multi-day interval. Do not emit RRULE for completed historical tasks. Exclude archived/completed tasks from NEW Google creates. Preserve valid short meeting blocks and explicit all-day multi-day ranges. No task source dates, historical records or external events were deleted. Existing Google archive/event cleanup remains a separate migration/reconciliation concern.

Validation updated: 85 tests pass; TypeScript passes. Production deployment and Apple subscription refresh still pending.
