-- Telegram user linking table
-- Links a Telegram user ID to a First Light user account

CREATE TABLE IF NOT EXISTS public.user_telegram_links (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  telegram_id bigint NOT NULL UNIQUE,
  telegram_username text,
  linked_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id)
);

-- RLS
ALTER TABLE public.user_telegram_links ENABLE ROW LEVEL SECURITY;

-- Users can read/manage their own link
CREATE POLICY "Users manage own telegram link"
  ON public.user_telegram_links FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role needs full access (for webhook lookups)
-- Service role bypasses RLS by default, so no extra policy needed.

-- Index for fast lookup by telegram_id (webhook path)
CREATE INDEX idx_telegram_links_telegram_id ON public.user_telegram_links(telegram_id);
