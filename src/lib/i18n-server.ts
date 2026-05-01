import "server-only";
import { createClient } from "@/lib/supabase/server";
import { LANGUAGES, type LanguageCode } from "@/lib/i18n";

export type I18nOverridesByLocale = Partial<
  Record<LanguageCode, Record<string, string>>
>;

/**
 * Server-side fetch of admin-edited text overrides from `site_content`.
 *
 * Called from the root layout so SSR HTML already has the admin's saved
 * strings — eliminates the flash of hardcoded defaults that the
 * client-only fetch caused.
 *
 * Public-read RLS lets anonymous landing visitors see overrides too.
 * On any error we return an empty map so a Supabase outage never blocks
 * the page from rendering.
 */
export async function fetchSiteOverrides(): Promise<I18nOverridesByLocale> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("site_content")
      .select("locale, key, value");
    if (error || !data) return {};
    const grouped: I18nOverridesByLocale = {};
    for (const row of data as Array<{
      locale: string;
      key: string;
      value: string;
    }>) {
      const code = LANGUAGES.find((l) => l.code === row.locale)?.code;
      if (!code) continue;
      (grouped[code] ??= {})[row.key] = row.value;
    }
    return grouped;
  } catch {
    return {};
  }
}
