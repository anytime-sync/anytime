# FL activation release — 2026-10-03

## Problem

Onboarding was mounted only in timeline mode, missing the default list mode. New accounts received tutorial tasks before the user captured real work. The homepage described scheduled Daily Editions, while the current product uses on-demand action briefs.

## Shipped changes

- Mount onboarding in both Today modes for accounts without real tasks.
- Replace a long tutorial with up to three real tasks, highest priority first, and a direct link to the first task. No invented timed work blocks.
- Preserve successful tasks on partial failure and retry only unsaved inputs.
- Remove automatic tutorial seeding while preserving new-user profiles and Personal lists. Existing task records remain untouched. Migration 20261003013517 was applied and verified against production.
- Rewrite the homepage headline and briefing FAQ in all five languages. Remove unverified testimonials.
- Offer optional first-party signed-in usage measurement, disabled by default, with a reversible checkbox on onboarding and /privacy. Strip private contents, URLs, unknown events and properties. Honor Do Not Track. Existing authenticated RLS scopes inserts to the account.
- Correct Google all-day event end dates to an exclusive next day when start and due share a date.

## Evaluation

For subsequent signup cohorts, inspect real task creation and completion, then return activity after one and seven days. Exclude the owner and the three historical seed titles. Use database task activity for overall activation; usage events only describe people who opted in and must not be presented as the full cohort. Track briefing requests, success and failure within that cohort. Evaluate useful actions rather than visitor totals; avoid adding new features until actual task activation improves.

## Limits and follow-up

This is a first activation improvement, not proof of product-market fit. Some secondary pricing and legacy feature copy still refer to Daily Editions. All-day date handling across browser/profile/calendar time zones needs a coordinated model change. Recurring COUNT handling and atomic completion, durable Google write retry and archive cleanup remain documented in fl-logic-review-2026-10-03.md. No customer messages or new campaigns were sent.
