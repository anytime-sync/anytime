# Public content fact sheet

Reviewed 2026-10-18 against source and live settings. Recheck before changing product claims.

First Light is a personal planner for commitments and follow-through. AI assistance is optional. Preserve the existing visual identity when correcting copy.

| Claim | Evidence | Accurate boundary |
| --- | --- | --- |
| Briefing | `src/app/api/ai/action-brief/route.ts` | User-requested, source-linked suggestions from bounded task/calendar records. No automatic task changes. |
| Daily Edition | `src/app/api/ai/daily-edition/route.ts` | Legacy interface/name; do not promise scheduled morning delivery. |
| Planning | `src/app/api/ai/plan-day/route.ts`, `plan-week/route.ts` | Priority/quadrant suggestions, not automatic calendar blocking or measured energy optimization. |
| Availability | `src/lib/ai/schedule-context.ts`, `slots.ts` | Recorded schedule context only; missing records do not establish free time. |
| Plans | `src/lib/plans.ts`, `feature-flags.ts` | Free core planner/briefing; Plus calendar editing/reflection; Pro planning, capture, reviews, search, API/MCP. Live overrides win. |
| Limits | `src/lib/ai-rate-limit.ts` | Daily AI budgets on all plans. Do not say unlimited or invent a one-per-day free cap. |
| Prices | `src/lib/pricing.ts`, live `service_prices` | Runtime prices; verified USD 5/month Plus and USD 9/month Pro. Checkout governs terms. |
| Trials | billing checkout route and `src/lib/billing.ts` | No unconditional 14-day trial claim without verifying provider configuration. |
| MCP | `firstlight-mcp/src/tools/index.ts`, `src/app/api/v1` | Local source build exposes 21 tools, verified via stdio tools/list. Other configured connections may expose more. Authorization and compatible setup required. Suggestions and saved edits are separate. |
| MCP install | package source and registry check | Node >=20 source build. Both previously implied npm names returned 404. |
| Offline | `public/sw.js` | Cached pages only; saving, sync and AI require internet. |
| Push | service worker and push settings | Depends on browser/device support and permission. |
| Sharing | Groups and feature matrix | Shared lists in beta, not a general enterprise collaboration claim. |
| Export | `src/app/api/account/export/route.ts` | Supported JSON records, not every database row or attachment byte. |
| Processing | analytics components, AI routes, `src/lib/voyage.ts`, billing | Analytics and providers process relevant data. No blanket no-tracking or zero-retention claim. |

Live `site_content` overrides only contained compatible kicker/hero copy. No `site_design` text overrides were returned. No settings, prices or entitlements were changed.

## Editorial rules

- Identify examples as examples, never invented customer records or outcomes.
- Require evidence for adoption metrics, testimonials, speed guarantees and superiority claims.
- Maintain factual consistency across English, Traditional/Simplified Chinese, Japanese and Korean.
- Pricing FAQ structured data uses the same translation keys as visible answers.
- Todoist and Notion both have official MCP servers. Do not describe either as lacking MCP.
- Preserve article URLs/publication dates and add the actual revision date.
- Contact/support: `info@firstlight.to`.

## Official sources

- https://developer.todoist.com/api/v1/
- https://www.todoist.com/features
- https://www.notion.com/product
- https://developers.notion.com/guides/mcp/overview
- https://culturedcode.com/things/features/
- https://ticktick.com/?language=en_us
- https://www.sunsama.com
- https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data

## Verification boundaries

This audits content against implementation, not every integration's reliability. Customer calendar writes, paid checkout, email delivery and AI output quality were not exercised. Historical screenshots are labeled as examples because panels have changed. Corrected service descriptions do not establish a legal or security certification.
