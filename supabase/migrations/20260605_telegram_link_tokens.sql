-- Telegram linking tokens (short-lived codes for account linking)
CREATE TABLE IF NOT EXISTS public.telegram_link_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- RLS — service role only (bypass by default)
ALTER TABLE public.telegram_link_tokens ENABLE ROW LEVEL SECURITY;

-- Index for fast lookup by code
CREATE INDEX idx_telegram_link_tokens_code ON public.telegram_link_tokens(code);

-- Auto-cleanup: delete expired tokens (optional — we also check in code)
