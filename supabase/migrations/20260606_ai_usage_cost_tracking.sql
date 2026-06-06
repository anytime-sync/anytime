-- Add token tracking and cost estimation to ai_usage_log
-- This enables per-user AI cost analysis for margin monitoring.

ALTER TABLE public.ai_usage_log
  ADD COLUMN IF NOT EXISTS input_tokens  integer,
  ADD COLUMN IF NOT EXISTS output_tokens integer,
  ADD COLUMN IF NOT EXISTS estimated_cost_usd numeric(10,6);

-- Index for cost analysis queries (per-user, per-day)
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_cost_analysis
  ON public.ai_usage_log (user_id, created_at DESC)
  WHERE estimated_cost_usd IS NOT NULL;

COMMENT ON COLUMN public.ai_usage_log.input_tokens IS 'Input tokens reported by the model response';
COMMENT ON COLUMN public.ai_usage_log.output_tokens IS 'Output tokens reported by the model response';
COMMENT ON COLUMN public.ai_usage_log.estimated_cost_usd IS 'Estimated USD cost based on model pricing at time of call';