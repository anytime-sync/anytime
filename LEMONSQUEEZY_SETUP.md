# Lemon Squeezy Billing Setup

First Light billing via Lemon Squeezy (Merchant of Record).
Replaces Stripe for markets like Taiwan where Stripe isn't available.

## 1. Create Products in Lemon Squeezy Dashboard

Go to [app.lemonsqueezy.com](https://app.lemonsqueezy.com) → Store → Products:

### Product 1: First Light Plus
- Name: `First Light Plus`
- Description: `Two-way calendar sync, unlimited Daily Editions, end-of-day reflection.`
- Pricing: **$3 USD / month** (recurring, monthly)
- Copy the **Variant ID** (visible in the URL or API)

### Product 2: First Light Pro
- Name: `First Light Pro`
- Description: `Full AI co-pilot — Plan my day, Voice → Task, Smart triage, and the review suite.`
- Pricing: **$9 USD / month** (recurring, monthly)
- Copy the **Variant ID**

## 2. Apply the database migration

Run `supabase/migrations/0023_add_plus_vip_plan_tiers.sql` against your
Supabase project. This widens the plan check constraint to include 'plus'
and 'vip' tiers.

## 3. Configure environment variables

Set in Vercel → Project → Settings → Environment Variables:

| Variable | Value |
|---|---|
| `LEMONSQUEEZY_API_KEY` | LS Dashboard → Settings → API → Create API key |
| `LEMONSQUEEZY_STORE_ID` | LS Dashboard → Settings → Store (numeric ID) |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | Set after step 4 |
| `LEMONSQUEEZY_PLUS_VARIANT_ID` | Variant ID from step 1 (Product 1) |
| `LEMONSQUEEZY_PRO_VARIANT_ID` | Variant ID from step 1 (Product 2) |

Keep existing Supabase env vars (`NEXT_PUBLIC_SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`).

**Note:** You can keep the Stripe env vars set — the checkout route auto-detects
which provider to use. Lemon Squeezy takes priority when `LEMONSQUEEZY_API_KEY`
is present.

## 4. Set up the webhook endpoint

In LS Dashboard → Settings → Webhooks → **Create Webhook**:

- Callback URL: `https://firstlight.to/api/webhooks/lemonsqueezy`
- Events to listen to:
  - `subscription_created`
  - `subscription_updated`
  - `subscription_cancelled`
  - `subscription_expired`
- Signing secret: Copy into `LEMONSQUEEZY_WEBHOOK_SECRET` on Vercel
- Redeploy so the new env vars take effect.

## 5. Test

1. Use LS test mode (toggle in dashboard)
2. Sign up as a test user on firstlight.to
3. Click "Upgrade to Plus" or "Upgrade to Pro"
4. Complete checkout with test card
5. Verify:
   - Webhook hit: check Vercel function logs
   - Plan updated: `SELECT * FROM subscriptions WHERE user_id = '...'`
   - UI reflects: settings page shows correct plan

## Architecture

```
User clicks Upgrade
  → POST /api/billing/checkout { plan: "plus" | "pro" }
  → createCheckout() in src/lib/lemonsqueezy.ts
  → Redirect to Lemon Squeezy hosted checkout
  → User pays
  → LS webhook → POST /api/webhooks/lemonsqueezy
  → Upsert into public.subscriptions
  → user_plans view reflects new plan
  → Client reads via useUserPlan() hook
```

## Files Changed

| File | Change |
|---|---|
| `src/lib/lemonsqueezy.ts` | NEW — LS SDK, checkout, webhook helpers |
| `src/lib/billing.ts` | Updated Plan type, added isPlusOrAbove() |
| `src/app/api/webhooks/lemonsqueezy/route.ts` | NEW — webhook handler |
| `src/app/api/billing/checkout/route.ts` | Updated — LS + Stripe dual support |
| `src/app/api/billing/portal/route.ts` | Updated — LS + Stripe dual support |
| `src/app/api/billing/prices/route.ts` | Updated — returns Plus + Pro prices |
| `src/hooks/use-pricing.ts` | Updated — usePrices() for both tiers |
| `src/app/pricing/page.tsx` | Updated — $3 Plus pricing |
| `supabase/migrations/0023_*.sql` | NEW — adds plus/vip to plan constraint |
