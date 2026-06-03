# Lemon Squeezy Billing Setup

First Light uses Lemon Squeezy as merchant-of-record. They handle payments,
tax, invoices, and compliance. We just handle subscription state.

## Plan Tiers

| Plan | Price | What's included |
|------|-------|----------------|
| Free | $0 | Full task system, calendar view, GCal read, Daily Edition (1/day) |
| Plus | ~$5/mo | Two-way GCal sync, unlimited Daily Editions, end-of-day Reflection |
| Pro | ~$9/mo | Full AI co-pilot: Plan my day/week, Morning Co-pilot, Voice/Snapshot→Task, Smart triage, Goal tracker, Weekly review, Semantic search, API access |

## 1. Create products in Lemon Squeezy

In the [LS Dashboard](https://app.lemonsqueezy.com):

### Product 1: First Light Plus
- **Products → New Product**
- Name: `First Light Plus`
- Description: `Two-way calendar sync, unlimited Daily Editions, and daily reflections.`
- Pricing: Subscription, Monthly, $5/mo (or your chosen price)
- Note the **Variant ID**

### Product 2: First Light Pro
- **Products → New Product**
- Name: `First Light Pro`
- Description: `AI co-pilot for your tasks — Plan my day, Voice→Task, Smart triage, and the full review suite.`
- Pricing: Subscription, Monthly, $9/mo (or your chosen price)
- Note the **Variant ID**

Also note your **Store ID** (Settings → General → Store ID).

## 2. Apply the database migration

Run `supabase/migrations/0020_lemon_squeezy_billing.sql` against your project.

If migrating from Stripe, this renames `stripe_customer_id` → `ls_customer_id`
and `stripe_subscription_id` → `ls_subscription_id`.

## 3. Configure environment variables

Set in Vercel → Project → Settings → Environment Variables:

| Variable | Value |
|---|---|
| `LEMONSQUEEZY_API_KEY` | API key from LS → Settings → API |
| `LEMONSQUEEZY_STORE_ID` | Your store ID |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | Webhook signing secret (step 4) |
| `LEMONSQUEEZY_VARIANT_ID_PLUS` | Variant ID for Plus monthly |
| `LEMONSQUEEZY_VARIANT_ID_PRO` | Variant ID for Pro monthly |
| `LEMONSQUEEZY_PLUS_PRICE_CENTS` | Price in cents, e.g. `500` for $5 |
| `LEMONSQUEEZY_PRO_PRICE_CENTS` | Price in cents, e.g. `900` for $9 |
| `LEMONSQUEEZY_CURRENCY` | Currency code, e.g. `usd` |

## 4. Set up the webhook

In LS Dashboard → Settings → Webhooks → New Webhook:

- **Callback URL:** `https://firstlight.to/api/webhooks/lemonsqueezy`
- **Signing secret:** generate one and save as `LEMONSQUEEZY_WEBHOOK_SECRET`
- **Events to listen to:**
  - `subscription_created`
  - `subscription_updated`
  - `subscription_cancelled`
  - `subscription_expired`
  - `subscription_resumed`
  - `subscription_paused`

## 5. Test

1. Use LS test mode
2. Sign in to First Light, go to Settings → Billing → **Upgrade to Plus** or **Pro**
3. Complete checkout with test card
4. Verify `subscriptions` table has a row with correct `plan` and `status='active'`
5. `user_plans` view should return the correct plan
6. Feature gates should unlock accordingly

## 6. Go live

Switch LS API key from test to production. Redeploy.

## Architecture

```
User clicks Upgrade
    ↓
POST /api/billing/checkout { plan: "plus" | "pro" }
    ↓
LS hosted checkout → user pays
    ↓
LS webhook → POST /api/webhooks/lemonsqueezy
    ↓
Verify HMAC signature → upsert subscriptions table
    ↓
user_plans view = coalesce(plan_override, subscription.plan, 'free')
    ↓
checkAiBudget → canUseFeature(plan, featureId) → planSatisfies(plan, minPlan)
```

## What gates each tier

See `src/lib/plans.ts` for the full feature matrix.
The `planSatisfies()` function uses rank: free=0 < plus=1 < pro=2 < team=3.
VIP is treated as Pro (rank 2).
