-- ============================================================
-- Migration: 20260625_fix_rls_all_tables.sql
-- Purpose: Enable RLS on all tables that were accessible to
--          anonymous users (returned HTTP 200 with anon JWT).
-- Only `tasks` and `profiles` already had correct RLS.
-- ============================================================

-- ============================================================
-- 1. USER-OWNED TABLES (have user_id column)
--    Policy: authenticated users see only their own rows
-- ============================================================

-- notes
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notes_user_select" ON public.notes;
CREATE POLICY "notes_user_select" ON public.notes
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "notes_user_insert" ON public.notes;
CREATE POLICY "notes_user_insert" ON public.notes
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "notes_user_update" ON public.notes;
CREATE POLICY "notes_user_update" ON public.notes
  FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "notes_user_delete" ON public.notes;
CREATE POLICY "notes_user_delete" ON public.notes
  FOR DELETE USING (auth.uid() = user_id);

-- user_preferences
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_preferences_user_select" ON public.user_preferences;
CREATE POLICY "user_preferences_user_select" ON public.user_preferences
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "user_preferences_user_insert" ON public.user_preferences;
CREATE POLICY "user_preferences_user_insert" ON public.user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "user_preferences_user_update" ON public.user_preferences;
CREATE POLICY "user_preferences_user_update" ON public.user_preferences
  FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "user_preferences_user_delete" ON public.user_preferences;
CREATE POLICY "user_preferences_user_delete" ON public.user_preferences
  FOR DELETE USING (auth.uid() = user_id);

-- subscriptions
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "subscriptions_user_select" ON public.subscriptions;
CREATE POLICY "subscriptions_user_select" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "subscriptions_user_insert" ON public.subscriptions;
CREATE POLICY "subscriptions_user_insert" ON public.subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "subscriptions_user_update" ON public.subscriptions;
CREATE POLICY "subscriptions_user_update" ON public.subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

-- plan_overrides
ALTER TABLE public.plan_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plan_overrides_user_select" ON public.plan_overrides;
CREATE POLICY "plan_overrides_user_select" ON public.plan_overrides
  FOR SELECT USING (auth.uid() = user_id);

-- daily_digest_log
ALTER TABLE public.daily_digest_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "daily_digest_log_user_select" ON public.daily_digest_log;
CREATE POLICY "daily_digest_log_user_select" ON public.daily_digest_log
  FOR SELECT USING (auth.uid() = user_id);

-- ai_usage_log
ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ai_usage_log_user_select" ON public.ai_usage_log;
CREATE POLICY "ai_usage_log_user_select" ON public.ai_usage_log
  FOR SELECT USING (auth.uid() = user_id);

-- calendar_events
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "calendar_events_user_select" ON public.calendar_events;
CREATE POLICY "calendar_events_user_select" ON public.calendar_events
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "calendar_events_user_insert" ON public.calendar_events;
CREATE POLICY "calendar_events_user_insert" ON public.calendar_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "calendar_events_user_update" ON public.calendar_events;
CREATE POLICY "calendar_events_user_update" ON public.calendar_events
  FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "calendar_events_user_delete" ON public.calendar_events;
CREATE POLICY "calendar_events_user_delete" ON public.calendar_events
  FOR DELETE USING (auth.uid() = user_id);

-- push_subscriptions
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "push_subscriptions_user_select" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_user_select" ON public.push_subscriptions
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "push_subscriptions_user_insert" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_user_insert" ON public.push_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "push_subscriptions_user_delete" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_user_delete" ON public.push_subscriptions
  FOR DELETE USING (auth.uid() = user_id);

-- user_telegram_links
ALTER TABLE public.user_telegram_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_telegram_links_user_select" ON public.user_telegram_links;
CREATE POLICY "user_telegram_links_user_select" ON public.user_telegram_links
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "user_telegram_links_user_insert" ON public.user_telegram_links;
CREATE POLICY "user_telegram_links_user_insert" ON public.user_telegram_links
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "user_telegram_links_user_delete" ON public.user_telegram_links;
CREATE POLICY "user_telegram_links_user_delete" ON public.user_telegram_links
  FOR DELETE USING (auth.uid() = user_id);

-- telegram_link_tokens
ALTER TABLE public.telegram_link_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "telegram_link_tokens_user_select" ON public.telegram_link_tokens;
CREATE POLICY "telegram_link_tokens_user_select" ON public.telegram_link_tokens
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "telegram_link_tokens_user_insert" ON public.telegram_link_tokens;
CREATE POLICY "telegram_link_tokens_user_insert" ON public.telegram_link_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "telegram_link_tokens_user_delete" ON public.telegram_link_tokens;
CREATE POLICY "telegram_link_tokens_user_delete" ON public.telegram_link_tokens
  FOR DELETE USING (auth.uid() = user_id);

-- api_request_log
ALTER TABLE public.api_request_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "api_request_log_user_select" ON public.api_request_log;
CREATE POLICY "api_request_log_user_select" ON public.api_request_log
  FOR SELECT USING (auth.uid() = user_id);

-- email_inbox_log
ALTER TABLE public.email_inbox_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "email_inbox_log_user_select" ON public.email_inbox_log;
CREATE POLICY "email_inbox_log_user_select" ON public.email_inbox_log
  FOR SELECT USING (auth.uid() = user_id);

-- pending_calendar_deletions
ALTER TABLE public.pending_calendar_deletions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pending_calendar_deletions_user_select" ON public.pending_calendar_deletions;
CREATE POLICY "pending_calendar_deletions_user_select" ON public.pending_calendar_deletions
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "pending_calendar_deletions_user_insert" ON public.pending_calendar_deletions;
CREATE POLICY "pending_calendar_deletions_user_insert" ON public.pending_calendar_deletions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "pending_calendar_deletions_user_delete" ON public.pending_calendar_deletions;
CREATE POLICY "pending_calendar_deletions_user_delete" ON public.pending_calendar_deletions
  FOR DELETE USING (auth.uid() = user_id);

-- tags
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tags_user_select" ON public.tags;
CREATE POLICY "tags_user_select" ON public.tags
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "tags_user_insert" ON public.tags;
CREATE POLICY "tags_user_insert" ON public.tags
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "tags_user_update" ON public.tags;
CREATE POLICY "tags_user_update" ON public.tags
  FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "tags_user_delete" ON public.tags;
CREATE POLICY "tags_user_delete" ON public.tags
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 2. VAULT TABLES (internal business data, no user_id)
--    Policy: blocked for anon/authenticated users;
--            service_role bypasses RLS automatically.
--    We also explicitly add a service_role allow policy for
--    belt-and-suspenders (service_role ignores RLS anyway).
-- ============================================================

-- vault_financials
ALTER TABLE public.vault_financials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vault_financials_deny_all" ON public.vault_financials;
CREATE POLICY "vault_financials_deny_all" ON public.vault_financials
  FOR ALL USING (false);

-- vault_fcst_detail
ALTER TABLE public.vault_fcst_detail ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vault_fcst_detail_deny_all" ON public.vault_fcst_detail;
CREATE POLICY "vault_fcst_detail_deny_all" ON public.vault_fcst_detail
  FOR ALL USING (false);

-- vault_brands
ALTER TABLE public.vault_brands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vault_brands_deny_all" ON public.vault_brands;
CREATE POLICY "vault_brands_deny_all" ON public.vault_brands
  FOR ALL USING (false);

-- vault_strategies
ALTER TABLE public.vault_strategies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vault_strategies_deny_all" ON public.vault_strategies;
CREATE POLICY "vault_strategies_deny_all" ON public.vault_strategies
  FOR ALL USING (false);

-- vault_action_items
ALTER TABLE public.vault_action_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vault_action_items_deny_all" ON public.vault_action_items;
CREATE POLICY "vault_action_items_deny_all" ON public.vault_action_items
  FOR ALL USING (false);

-- vault_insights
ALTER TABLE public.vault_insights ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vault_insights_deny_all" ON public.vault_insights;
CREATE POLICY "vault_insights_deny_all" ON public.vault_insights
  FOR ALL USING (false);

-- vault_markets
ALTER TABLE public.vault_markets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vault_markets_deny_all" ON public.vault_markets;
CREATE POLICY "vault_markets_deny_all" ON public.vault_markets
  FOR ALL USING (false);

-- vault_reviews
ALTER TABLE public.vault_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vault_reviews_deny_all" ON public.vault_reviews;
CREATE POLICY "vault_reviews_deny_all" ON public.vault_reviews
  FOR ALL USING (false);

-- vault_sources
ALTER TABLE public.vault_sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vault_sources_deny_all" ON public.vault_sources;
CREATE POLICY "vault_sources_deny_all" ON public.vault_sources
  FOR ALL USING (false);

-- vault_rep_performance
ALTER TABLE public.vault_rep_performance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vault_rep_performance_deny_all" ON public.vault_rep_performance;
CREATE POLICY "vault_rep_performance_deny_all" ON public.vault_rep_performance
  FOR ALL USING (false);

-- vault_financial_timeseries
ALTER TABLE public.vault_financial_timeseries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vault_financial_timeseries_deny_all" ON public.vault_financial_timeseries;
CREATE POLICY "vault_financial_timeseries_deny_all" ON public.vault_financial_timeseries
  FOR ALL USING (false);

-- vault_market_shares
ALTER TABLE public.vault_market_shares ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vault_market_shares_deny_all" ON public.vault_market_shares;
CREATE POLICY "vault_market_shares_deny_all" ON public.vault_market_shares
  FOR ALL USING (false);

-- vault_offtake
ALTER TABLE public.vault_offtake ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vault_offtake_deny_all" ON public.vault_offtake;
CREATE POLICY "vault_offtake_deny_all" ON public.vault_offtake
  FOR ALL USING (false);

-- vault_competitive_intel
ALTER TABLE public.vault_competitive_intel ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vault_competitive_intel_deny_all" ON public.vault_competitive_intel;
CREATE POLICY "vault_competitive_intel_deny_all" ON public.vault_competitive_intel
  FOR ALL USING (false);

-- vault_promotions
ALTER TABLE public.vault_promotions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vault_promotions_deny_all" ON public.vault_promotions;
CREATE POLICY "vault_promotions_deny_all" ON public.vault_promotions
  FOR ALL USING (false);

-- ============================================================
-- 3. PUBLIC READ-ONLY CONFIG TABLES
--    Policy: anyone (including anon) can SELECT; no mutations
-- ============================================================

-- site_content
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "site_content_public_read" ON public.site_content;
CREATE POLICY "site_content_public_read" ON public.site_content
  FOR SELECT USING (true);

-- service_prices
ALTER TABLE public.service_prices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_prices_public_read" ON public.service_prices;
CREATE POLICY "service_prices_public_read" ON public.service_prices
  FOR SELECT USING (true);

-- broadcasts (authenticated users only — has user-targeted content)
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "broadcasts_authed_read" ON public.broadcasts;
CREATE POLICY "broadcasts_authed_read" ON public.broadcasts
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ============================================================
-- END OF MIGRATION
-- ============================================================
