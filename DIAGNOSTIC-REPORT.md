# First Light — Pre-Launch Diagnostic Report
**Date:** June 4, 2026 (Taipei time)  
**Auditor:** Nemo  
**Scope:** Security, architecture, billing readiness, performance, code quality

---

## Executive Summary

First Light is **well-built for a solo-developer product**. Auth is consistent, RLS covers all tables, cron routes are protected, and the AI rate limiter doubles as a plan gate. However, there are **3 critical items** and **5 important items** to address before charging real money.

---

## 🔴 CRITICAL (fix before going live)

### 1. No Security Headers in next.config
`next.config.mjs` has zero security headers. Any production SaaS should have:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY` (prevents clickjacking — someone embeds your app in an iframe)
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Content-Security-Policy` (at minimum frame-ancestors 'none')

**Risk:** Clickjacking attacks. An attacker embeds your billing page in an iframe and tricks users into clicking "Upgrade".

**Fix:** Add `headers()` to `next.config.mjs`. 10-minute fix.

### 2. AI Route `morning-copilot/respond` Missing Rate Limit
All 18 other AI routes have `checkAiBudget()`. This one doesn't. A user could spam the respond endpoint and burn Anthropic credits with zero throttling.

**Risk:** Direct financial exposure via unmetered LLM calls.

**Fix:** Add `checkAiBudget(userId, "morning_copilot")` to the respond route. 2-minute fix.

### 3. Feature Gating is "Informational Only" — Not Actually Enforced
From the summary context: "All gating is informational only — features not actually locked yet."

The `checkAiBudget` function DOES gate some AI features server-side (daily_edition, weekly_retro, plan_week, plan_day, morning_copilot, quadrant, goal_decompose, search, reflection). But several AI features are NOT in the `AI_FEATURE_ID` map and bypass plan checks entirely:
- `parse_task` (200/day free)
- `estimate_task` (200/day free)
- `reschedule_task` (60/day free)
- `find_time` (60/day free)
- `prep_meeting` (60/day free)
- `procrastination` (20/day free)
- `translate_task` (300/day free)

Some of these may be intentionally free (parse_task needs to be free for basic UX). But prep_meeting, find_time, and translate_task are premium features being given away.

**Risk:** Free users get full access to expensive AI features. No revenue differentiation between free and paid.

**Fix:** Decide which features are free vs Pro, add them to `AI_FEATURE_ID` map in `ai-rate-limit.ts`. Then actually lock the UI (show upgrade modal instead of calling the API).

---

## 🟡 IMPORTANT (fix soon after launch)

### 4. No Test Suite
1 test file (`i18n.test.ts`). 286 source files. Zero coverage on billing, webhooks, auth, AI routes.

**Risk:** Regressions when iterating. Webhook signature verification can't be tested without tests.

**Recommendation:** At minimum, write tests for: billing webhook handler, `checkAiBudget`, `lsSubscriptionToRow`, and the checkout flow.

### 5. Soft-Fail Open on Rate Limit DB Error
In `checkAiBudget`, if the Supabase query fails:
```ts
if (error) {
  console.error("[ai_rate_limit]", error);
  return { ok: true }; // Soft-fail open
}
```
If Supabase goes down, ALL rate limits stop working. Every user gets unlimited AI calls.

**Fix:** Consider fail-closed (return `ok: false`) or use an in-memory fallback counter.

### 6. No Next.js Version Pin
`"next": "^14.2.32"` — the caret means `npm install` can pull 14.3.x which may have breaking changes.

**Fix:** Pin to exact version: `"next": "14.2.32"`.

### 7. ESLint Skipped in Builds
`eslint: { ignoreDuringBuilds: true }` — means lint errors don't block deploys.

**Fix:** Enable once you have CI/CD stability.

### 8. Missing `Content-Security-Policy` for Lemon Squeezy
When LS checkout opens in a new tab, this isn't an issue. But if you ever use their embed/overlay checkout, you'll need to whitelist `*.lemonsqueezy.com` in your CSP.

---

## ✅ GOOD — What's Solid

### Auth Architecture
- **81 of 105** API routes use `createClient` from `@/lib/supabase/server` (cookie-based auth)
- **Admin routes** use `requireAdmin()` with hardcoded admin email check
- **Cron routes** use `isAuthorizedCron()` with timing-safe CRON_SECRET comparison
- **v1 API routes** use Personal Access Tokens via `requireApiAuth()`
- **Webhooks** use proper signature verification (LS: HMAC-SHA256, Telegram: secret verify, Inbox: Bearer token)
- Middleware refreshes sessions on all non-API routes

### Database Security
- **RLS enabled on all 27 tables** — 1:1 match between CREATE TABLE and ENABLE ROW LEVEL SECURITY
- No raw SQL / SQL injection vectors found
- Service role usage is appropriate (webhook handlers, cron jobs, admin ops)

### Code Quality
- Zero `eval()`, `innerHTML`, or `dangerouslySetInnerHTML` usage
- No hardcoded secrets in source code
- No CORS wildcards
- No error stack traces leaked to clients
- Clean separation of concerns (lib/ for shared logic, app/api/ for routes)
- Zod validation on input where it matters
- TypeScript strict mode with zero type errors

### Billing Architecture
- Clean webhook → DB → view → UI pattern
- `user_plans` view returns 'free' as default (fail-safe)
- Subscription table has proper indexes
- Checkout uses hosted URLs (no PCI scope)
- HMAC signature verification with timing-safe comparison

### Infrastructure
- Vercel crons properly configured (5 scheduled jobs)
- GDPR compliance: data export + account deletion with email confirmation
- i18n support built in
- Push notifications (web-push)
- Google Calendar two-way sync

---

## 📊 By the Numbers

| Metric | Value |
|---|---|
| Total source files | 286 |
| API routes | 105 |
| AI routes | 19 |
| AI routes with rate limiting | 18/19 (95%) |
| AI features with plan gating | 10/17 (59%) |
| Tables with RLS | 27/27 (100%) |
| Test files | 1 |
| Security headers | 0 |
| Hardcoded secrets | 0 |
| SQL injection vectors | 0 |

---

## 🎯 Pre-Launch Checklist

1. [ ] Add security headers to `next.config.mjs`
2. [ ] Add `checkAiBudget` to `morning-copilot/respond` route
3. [ ] Decide free vs Pro AI features and update `AI_FEATURE_ID` map
4. [ ] Lock Pro features in the UI (upgrade modal, not just hidden buttons)
5. [ ] Run LS DB migration (`0020_lemon_squeezy_billing.sql`)
6. [ ] Set up LS product + webhook + env vars
7. [ ] Test full checkout→webhook→subscription flow in LS test mode
8. [ ] Pin Next.js version
9. [ ] Write billing webhook tests

---

*This report covers static analysis only. A live penetration test is recommended before scaling beyond early adopters.*
