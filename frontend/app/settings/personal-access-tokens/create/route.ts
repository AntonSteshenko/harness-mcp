import { NextRequest, NextResponse } from "next/server";
import { createPersonalAccessToken } from "@/lib/oauth/personalAccessTokens";
import { hasActiveOwnerSession } from "@/lib/oauth/session";
import { appendAuditLine } from "@/lib/oauth/store";
import type { AuditLogEntry } from "@/lib/oauth/types";
import { resolveLanguage } from "@/lib/i18n/resolve";
import { getDictionary } from "@/lib/i18n/dictionaries";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Creates a new personal access token (FR-001, FR-002, FR-009). */
export async function POST(request: NextRequest) {
  const signedIn = await hasActiveOwnerSession();
  if (!signedIn) {
    return NextResponse.json(
      { error: "invalid_request", error_description: "No active owner session" },
      { status: 401 },
    );
  }

  const form = await request.formData();
  const name = form.get("name")?.toString().trim() ?? "";

  if (!name) {
    return NextResponse.json(
      { error: "invalid_request", error_description: "A name is required" },
      { status: 400 },
    );
  }

  const { record, secretValue } = await createPersonalAccessToken(name);

  await appendAuditLine(
    JSON.stringify({
      at: new Date().toISOString(),
      event: "pat_created",
      clientId: record.id,
      clientName: record.name,
    } satisfies AuditLogEntry),
  );

  const language = await resolveLanguage();
  const dict = getDictionary(language).settings.pat;

  // Rendered directly in the response body — never via redirect/query string,
  // so the secret never lands in a URL, browser history, or server access
  // log (research.md §4). This is the only place it is ever shown (FR-002).
  const html = `<!doctype html>
<html lang="${language}">
<body style="font-family: system-ui, sans-serif; max-width: 640px; margin: 2rem auto;">
  <h1>${escapeHtml(dict.createdTitle)}</h1>
  <p>${escapeHtml(dict.createdBody)}</p>
  <pre style="background: #f5f5f5; padding: 1rem; overflow-wrap: anywhere; white-space: pre-wrap;">${escapeHtml(secretValue)}</pre>
  <p><a href="/settings/personal-access-tokens">${escapeHtml(dict.backLink)}</a></p>
</body>
</html>`;

  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
