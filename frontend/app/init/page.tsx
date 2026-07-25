import type { CSSProperties } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { checkOsStatus } from "@/lib/os/init";
import { hasActiveOwnerSession } from "@/lib/oauth/session";
import { verifyStorageConnection } from "@/lib/storage/client";
import { StorageConfigError } from "@/lib/storage/errors";
import { detectBrowserLanguage } from "@/lib/i18n/detect";
import { resolveLanguage } from "@/lib/i18n/resolve";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { EnvSetupHelper } from "./EnvSetupHelper";
import { LanguageConfirm } from "./LanguageConfirm";
import { McpConnectManual } from "./McpConnectManual";

const PAGE_STYLE: CSSProperties = {
  maxWidth: 640,
  margin: "4rem auto",
  fontFamily: "system-ui, sans-serif",
};

/** Bootstraps a fresh Company OS in the configured storage bucket (spec 014). */
export default async function InitPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  try {
    await verifyStorageConnection();
  } catch (err) {
    if (!(err instanceof StorageConfigError)) throw err;

    // No Company OS can exist yet (storage itself isn't reachable), so this
    // uses live browser detection directly rather than resolveLanguage() —
    // which would call checkOsStatus() and fail on the same unreachable
    // storage (spec 015 FR-014, research.md §7).
    const hdrs = await headers();
    const language = detectBrowserLanguage(hdrs.get("accept-language"));

    return (
      <main style={PAGE_STYLE}>
        <EnvSetupHelper language={language} />
      </main>
    );
  }

  const signedIn = await hasActiveOwnerSession();
  if (!signedIn) {
    redirect(`/oauth/login?continue=${encodeURIComponent("/init")}`);
  }

  const status = await checkOsStatus();
  const params = await searchParams;
  const language = await resolveLanguage();
  const dict = getDictionary(language);

  if (status === "partial") {
    return (
      <main style={PAGE_STYLE}>
        <h1>{dict.init.unexpectedStateTitle}</h1>
        <p>{dict.init.unexpectedStateBody}</p>
      </main>
    );
  }

  if (status === "already_initialized") {
    const hdrs = await headers();
    const host = hdrs.get("host") ?? "localhost:3000";
    const proto = hdrs.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    const mcpUrl = `${proto}://${host}/mcp`;

    return (
      <main style={PAGE_STYLE}>
        <McpConnectManual mcpUrl={mcpUrl} justCreated={params.created === "1"} dict={dict.init.mcpConnect} />
      </main>
    );
  }

  return (
    <main style={PAGE_STYLE}>
      <h1>{dict.init.setupTitle}</h1>
      <p>{dict.init.setupDescription}</p>
      <p>{dict.init.languagePrompt}</p>
      <form method="POST" action="/init/submit">
        <LanguageConfirm detected={language} />
        <button type="submit">{dict.init.submit}</button>
      </form>
    </main>
  );
}
