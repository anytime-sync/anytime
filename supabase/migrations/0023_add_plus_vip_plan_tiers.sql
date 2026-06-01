-- Migration: Add 'plus' and 'vip' plan tiers to subscriptions.
--
-- The plans.ts source of truth defines: free | plus | pro | vip | team
-- But the subscriptions table only allowed: pro | team
-- Free users have no row (by design), but plus and vip need to be stored.
--
-- vip = admin-comped Pro access (no payment required, owner grants manually)

-- 1. Widen the plan check constraint to include 'plus' and 'vip'
ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_plan_check;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_plan_check
  CHECK (plan IN ('plus', 'pro', 'vip', 'team'));

-- 2. Update the user_plans view to recognize 'plus' tier
CREATE OR REPLACE VIEW public.user_plans AS
  SELECT
    u.id AS user_id,
    COALESCE(
      CASE
        WHEN s.status IN ('active', 'trialing', 'past_due') THEN s.plan
        ELSE NULL
      END,
      'free'
    ) AS plan,
    s.status,
    s.current_period_end,
    s.cancel_at_period_end
  FROM auth.users u
  LEFT JOIN public.subscriptions s ON s.user_id = u.id;

GRANT SELECT ON public.user_plans TO authenticated;
