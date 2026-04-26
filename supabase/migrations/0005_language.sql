-- ===================================================================
-- 0005_language.sql
-- Adds preferred UI/AI output language to user_preferences.
-- Supported: en, zh-TW, zh-CN, ja, ko
-- ===================================================================
alter table user_preferences
  add column if not exists language text not null default 'en'
  check (language in ('en', 'zh-TW', 'zh-CN', 'ja', 'ko'));
