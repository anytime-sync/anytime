/**
 * Smoke test: every key in the StringKey union is present in every
 * language block. This catches the kind of partial-translation bug
 * that broke Vercel builds before (zh-TW had a key the union didn't,
 * or the union added a key without populating ja).
 */
import { describe, it, expect } from "vitest";
import { LANGUAGES, getTranslations, t } from "@/lib/i18n";

describe("i18n parity", () => {
  it("every language has the same set of keys", () => {
    const englishKeys = Object.keys(getTranslations("en")).sort();
    expect(englishKeys.length).toBeGreaterThan(100);
    for (const lang of LANGUAGES) {
      const keys = Object.keys(getTranslations(lang.code)).sort();
      expect(
        keys,
        `${lang.code} keys differ from en`
      ).toEqual(englishKeys);
    }
  });

  it("t() returns a non-empty string for every key in every language", () => {
    const englishKeys = Object.keys(getTranslations("en")) as Array<
      keyof ReturnType<typeof getTranslations>
    >;
    for (const lang of LANGUAGES) {
      for (const key of englishKeys) {
        const v = t(lang.code, key);
        expect(v, `${lang.code}/${key}`).toBeTruthy();
        expect(typeof v).toBe("string");
      }
    }
  });

  it("falls back to English when the language is unknown", () => {
    const v = t("xx-XX" as unknown as "en", "sidebar.today");
    expect(v).toBe(t("en", "sidebar.today"));
  });
});
