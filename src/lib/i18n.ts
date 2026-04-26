/**
 * i18n.ts — central language registry for First Light.
 *
 * Adding a new language means:
 *   1. add a row here (code, displayName, dateFnsLocale, aiName)
 *   2. update the CHECK constraint in supabase/migrations/0005_language.sql
 *   3. update the database constraint via a follow-up migration
 *
 * UI labels themselves stay in English for v1. The two places where the
 * user's language genuinely matters are:
 *   - AI-generated content (Daily Edition, Weekly Retro, parsed task titles)
 *   - Date formatting (date-fns locale)
 */
import { enUS, zhTW, zhCN, ja, ko, type Locale } from "date-fns/locale";

export type LanguageCode = "en" | "zh-TW" | "zh-CN" | "ja" | "ko";

export type LanguageDef = {
  code: LanguageCode;
  /** What we show in the picker. */
  displayName: string;
  /** date-fns locale object. */
  dateFnsLocale: Locale;
  /** Plain English name we feed Claude in the prompt. */
  aiName: string;
};

export const LANGUAGES: LanguageDef[] = [
  { code: "en",    displayName: "English",            dateFnsLocale: enUS, aiName: "English" },
  { code: "zh-TW", displayName: "繁體中文",            dateFnsLocale: zhTW, aiName: "Traditional Chinese (zh-TW)" },
  { code: "zh-CN", displayName: "简体中文",            dateFnsLocale: zhCN, aiName: "Simplified Chinese (zh-CN)" },
  { code: "ja",    displayName: "日本語",              dateFnsLocale: ja,   aiName: "Japanese" },
  { code: "ko",    displayName: "한국어",              dateFnsLocale: ko,   aiName: "Korean" },
];

export const DEFAULT_LANGUAGE: LanguageCode = "en";

export function getLanguage(code: string | null | undefined): LanguageDef {
  return (
    LANGUAGES.find((l) => l.code === code) ??
    LANGUAGES.find((l) => l.code === DEFAULT_LANGUAGE)!
  );
}
