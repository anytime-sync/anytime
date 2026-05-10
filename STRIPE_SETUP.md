# Stripe Billing Setup

First Light's billing layer. One-time configuration to turn on Pro tier.

## 1. Create Stripe products

In the Stripe dashboard ([dashboard.stripe.com](https://dashboard.stripe.com)):

1. **Products → + Add product**
   - Name: `First Light Pro`
   - Description: `Unlimited AI briefings + bi-directional Google Calendar sync`
2. **Pricing**
   - Recurring, Monthly
   - Set price (recommended: $9–12 USD)
   - Save and copy the **Price ID** (starts with `price_`)
3. (Optional) Enable annual pricing as a second price on the same product.

## 2. Apply the database migration

Run `supabase/migrations/0002_billing.sql` against your Supabase project. Adds:
- `public.subscriptions` table (one row per Pro user)
- `public.user_plans` view (drives client-side plan reads)
- RLS policies (user reads only own row)

## 3. Configure environment variables

Set in Vercel → Project → Settings → Environment Variables:

| Variable | Value |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys → Secret key (starts `sk_live_...` for prod, `sk_test_...` for test mode) |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Developers → Webhooks → endpoint signing secret (set after step 4) |
| `STRIPE_PRICE_ID_PRO_MONTHLY` | The price ID from step 1 (starts `price_...`) |
| `NEXT_PUBLIC_APP_URL` | Your production URL, e.g. `https://firstlight.to` |

The existing `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SUPABASE_URL` are
already required and are reused here.

## 4. Set up the webhook endpoint

In Stripe → Developers → Webhooks → **+ Add endpoint**:

- Endpoint URL: `https://firstlight.to/api/webhooks/stripe`
- Events to send:
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
- Save, then copy the **Signing secret** (starts `whsec_...`) into the
  `STRIPE_WEBHOOK_SECRET` env var on Vercel.
- Redeploy so the new env vars take effect.

## 5. Test with Stripe test mode

1. Switch your Stripe dashboard to **Test mode** (toggle in top-right).
2. Use `sk_test_...` for `STRIPE_SECRET_KEY` and the test-mode webhook secret.
3. Sign in to First Light, go to Settings → Billing → **Upgrade to Pro**.
4. On the Stripe-hosted Checkout page, use test card `4242 4242 4242 4242`
   with any future expiry, any CVC, any postal code.
5. After redirect back, your row in `public.subscriptions` should have
   `status='active'` and `user_plans` should return `plan='pro'`.
6. Test the Customer Portal: Settings → Billing → **Manage billing**.

## 6. Switch to live mode

Once verified in test mode:
1. Update env vars in Vercel to use `sk_live_...` and the live-mode webhook
   signing secret.
2. Redeploy.
3. Optionally, set up **Stripe Tax** for VAT/sales tax handling and
   **Promotion codes** for early-access discounts.

## What gates Pro vs Free

Today the gating is informational only — features are not actually locked
yet. Add `isPro(userId)` checks (from `@/lib/billing`) to AI route handlers
when you're ready to enforce limits. Recommended:

- **Free**: keep all native task features. Cap AI to 1 Daily Edition / day
  and disable Morning Co-pilot, Plan-my-day, Plan-my-week, Reflection.
- **Pro**: full AI access (still subject to the existing per-user daily
  budget in `ai-rate-limit.ts`).

Once gates land, the Settings → Billing UI's "Upgrade" button becomes the
primary conversion surface, and the Daily Edition page should show an
"Upgrade for unlimited briefs" prompt to free users at the cap.
