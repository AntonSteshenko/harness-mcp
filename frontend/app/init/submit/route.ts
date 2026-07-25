import { NextRequest, NextResponse } from "next/server";
import { initializeCompanyOs } from "@/lib/os/init";
import { hasActiveOwnerSession } from "@/lib/oauth/session";
import { isSupportedLanguage } from "@/lib/i18n/languages";
import { resolveLanguage } from "@/lib/i18n/resolve";
import { getDictionary } from "@/lib/i18n/dictionaries";

/**
 * Creates the initial Company OS skeleton in the confirmed language (spec 015
 * FR-004 through FR-006) — the only form field is `lang`, carrying the
 * visitor's selection from `LanguageConfirm` (contracts/language-resolution.md).
 */
export async function POST(request: NextRequest) {
  const dict = getDictionary(await resolveLanguage()).init;

  const signedIn = await hasActiveOwnerSession();
  if (!signedIn) {
    return NextResponse.json({ error: "unauthorized", message: dict.submitUnauthorized }, { status: 401 });
  }

  const formData = await request.formData();
  const lang = formData.get("lang");
  if (typeof lang !== "string" || !isSupportedLanguage(lang)) {
    return NextResponse.json({ error: "invalid_language", message: dict.submitInvalidLanguage }, { status: 400 });
  }

  await initializeCompanyOs(lang);

  const initUrl = new URL("/init", request.url);
  initUrl.searchParams.set("created", "1");
  return NextResponse.redirect(initUrl, { status: 303 });
}
