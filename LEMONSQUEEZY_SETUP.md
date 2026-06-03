# Lemon Squeezy Billing Setup

First Light uses Lemon Squeezy as merchant-of-record. They handle payments,
tax, invoices, and compliance. We just handle subscription state.

## 1. Create a product in Lemon Squeezy

In the [LS Dashboard](https://app.lemonsqueezy.com):

1. **Products → New Product**
   - Name: `First Light Pro`
   - Description: `AI co-pilot for your tasks — Plan my day, Morning Co-pilot, Voice→Task, and more.`
2. **Pricing**
   - Subscription, Monthly
   - Set price (recommended: $9 USD / month)
   - Save and note the **Variant ID** (visible in URL or product settings)
3. Note your **Store ID** (Settings → General → Store ID)

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
| `LEMONSQUEEZY_VARIANT_ID_PRO` | Variant ID for Pro monthly |
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
2. Sign in to First Light, go to Settings → Billing → **Upgrade to Pro**
3. Complete checkout with test card
4. Verify `subscriptions` table has a row with `status='active'`
5. `user_plans` view should return `plan='pro'`

## 6. Go live

Switch LS API key from test to production. Redeploy.

## What gates Pro vs Free

Same as before — see `src/lib/plans.ts` for the full feature matrix.
The `isPro(userId)` check in `src/lib/billing.ts` drives all gates.
