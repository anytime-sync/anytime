-- Migration: Stripe → Lemon Squeezy billing
--
-- Renames stripe_* columns to ls_* and adds variant_id.
-- The subscriptions table structure stays the same: one row per user,
-- written by webhook, read by user_plans view.
--
-- This is safe to run on a fresh or existing DB:
-- - If columns already exist (fresh schema), the renames will no-op.
-- - If stripe_* columns exist (migration from Stripe), they get renamed.

-- Rename columns (if they exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE public.subscriptions RENAME COLUMN stripe_customer_id TO ls_customer_id;
    ALTER TABLE public.subscriptions RENAME COLUMN stripe_subscription_id TO ls_subscription_id;
  END IF;
END $$;

-- Add variant_id column (tracks which LS variant/plan they bought)
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS variant_id text;

-- Update the index name
DROP INDEX IF EXISTS subscriptions_customer_idx;
CREATE INDEX IF NOT EXISTS subscriptions_ls_customer_idx
  ON public.subscriptions(ls_customer_id);

-- Add LS subscription ID index for webhook lookups
CREATE INDEX IF NOT EXISTS subscriptions_ls_sub_idx
  ON public.subscriptions(ls_subscription_id);
