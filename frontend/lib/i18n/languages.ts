/**
 * The six languages this app supports (spec 015, FR-001). Adding a seventh
 * means adding a code here, a `lib/os/templates/<code>/` pair, and a
 * `lib/i18n/dictionaries/<code>.ts` — nothing else keys off this list.
 */
export const SUPPORTED_LANGUAGES = ["en", "it", "ru", "fr", "de", "es"] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_NAMES: Record<SupportedLanguage, { native: string; english: string }> = {
  en: { native: "English", english: "English" },
  it: { native: "Italiano", english: "Italian" },
  ru: { native: "Русский", english: "Russian" },
  fr: { native: "Français", english: "French" },
  de: { native: "Deutsch", english: "German" },
  es: { native: "Español", english: "Spanish" },
};

export function isSupportedLanguage(value: string | null | undefined): value is SupportedLanguage {
  return !!value && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}
