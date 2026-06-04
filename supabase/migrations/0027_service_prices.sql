-- Migration: service_prices
-- Admin-editable pricing for plan tiers.
-- Falls back to env vars if no row exists.

CREATE TABLE IF NOT EXISTS public.service_prices (
  id         text PRIMARY KEY DEFAULT 'singleton',
  plus_cents integer NOT NULL DEFAULT 500,
  pro_cents  integer NOT NULL DEFAULT 900,
  currency   text    NOT NULL DEFAULT 'usd',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.service_prices ENABLE ROW LEVEL SECURITY;

-- Only service role (admin API routes) can read/write.
-- No direct client access.
CREATE POLICY "service_prices_service_only"
  ON public.service_prices
  FOR ALL
  USING (false);

-- Insert default row so the table is never empty.
INSERT INTO public.service_prices (id, plus_cents, pro_cents, currency)
VALUES ('singleton', 500, 900, 'usd')
ON CONFLICT (id) DO NOTHING;
