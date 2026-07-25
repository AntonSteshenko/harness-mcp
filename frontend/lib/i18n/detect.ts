import { isSupportedLanguage, SupportedLanguage } from "./languages";

/**
 * Maps a browser's `Accept-Language` header to one of the six supported
 * languages, walking the header's own preference order and matching on the
 * primary subtag only (`it-IT` → `it`). Defaults to `"en"` when the header
 * is absent or none of its subtags match (FR-003, research.md §2).
 */
export function detectBrowserLanguage(acceptLanguageHeader: string | null | undefined): SupportedLanguage {
  if (!acceptLanguageHeader) return "en";

  const candidates = acceptLanguageHeader
    .split(",")
    .map((entry) => entry.split(";")[0]?.trim().toLowerCase())
    .filter((tag): tag is string => !!tag)
    .map((tag) => tag.split("-")[0]);

  for (const candidate of candidates) {
    if (isSupportedLanguage(candidate)) return candidate;
  }

  return "en";
}
