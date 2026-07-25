import { cache } from "react";
import { headers } from "next/headers";
import { checkOsStatus } from "@/lib/os/init";
import { readFile } from "@/lib/storage/files";
import { StorageError } from "@/lib/storage/errors";
import { detectBrowserLanguage } from "./detect";
import { isSupportedLanguage, SupportedLanguage } from "./languages";

const LANGUAGE_MARKER_PATH = "os/language";

/**
 * Reads the Company OS's permanently confirmed language (spec 015 FR-006,
 * FR-007). Returns `null` when the marker file doesn't exist or its content
 * doesn't match one of the six supported codes (contracts/language-resolution.md)
 * — never an error; both cases mean "no stored language."
 */
export async function getSystemLanguage(): Promise<SupportedLanguage | null> {
  try {
    const { content } = await readFile(LANGUAGE_MARKER_PATH);
    const code = content.trim();
    return isSupportedLanguage(code) ? code : null;
  } catch (err) {
    if (err instanceof StorageError && err.code === "not_found") {
      return null;
    }
    throw err;
  }
}

/**
 * The single per-request language entry point (research.md §7, contracts/
 * language-resolution.md): a Company OS that doesn't exist yet uses live
 * browser detection (FR-014); one that exists uses its stored language
 * (FR-008), or falls back to English if it predates this feature (FR-013).
 * Wrapped in React's `cache()` so a single request never re-reads
 * `os/language` or re-checks `os/`/`data/` more than once.
 *
 * Pages with no other storage dependency (e.g. `/oauth/login`) now call this
 * too, so a reachable-but-misconfigured backend (wrong bucket, rejected
 * credentials — the narrower case `middleware.ts` doesn't already redirect
 * away, spec 014 research.md §8) must not turn a page that used to render
 * unconditionally into one that throws. Any unexpected error from
 * `checkOsStatus()` therefore falls back to live browser detection rather
 * than propagating.
 */
export const resolveLanguage = cache(async (): Promise<SupportedLanguage> => {
  const hdrs = await headers();

  let status: Awaited<ReturnType<typeof checkOsStatus>>;
  try {
    status = await checkOsStatus();
  } catch {
    return detectBrowserLanguage(hdrs.get("accept-language"));
  }

  if (status !== "already_initialized") {
    return detectBrowserLanguage(hdrs.get("accept-language"));
  }

  try {
    const stored = await getSystemLanguage();
    return stored ?? "en";
  } catch {
    return "en";
  }
});
