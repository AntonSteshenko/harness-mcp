import { redirect } from "next/navigation";
import { hasActiveOwnerSession } from "@/lib/oauth/session";
import { TOOL_CATALOG } from "@/lib/mcp-tools/catalog";
import { resolveLanguage } from "@/lib/i18n/resolve";
import { getDictionary } from "@/lib/i18n/dictionaries";

/** Owner-gated confirmation screen for one pending tool status change (spec 025 FR-002, FR-003). */
export default async function ConfirmToolStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>;
  searchParams: Promise<{ to?: string }>;
}) {
  const { name } = await params;
  const { to } = await searchParams;
  const currentUrl = `/tools/${encodeURIComponent(name)}/confirm?to=${encodeURIComponent(to ?? "")}`;

  const signedIn = await hasActiveOwnerSession();
  if (!signedIn) {
    redirect(`/oauth/login?continue=${encodeURIComponent(currentUrl)}`);
  }

  const dict = getDictionary(await resolveLanguage()).tools;
  const knownTool = TOOL_CATALOG.some((tool) => tool.name === name);
  const validStatus = to === "active" || to === "disabled";

  if (!knownTool || !validStatus) {
    return (
      <main style={{ maxWidth: 640, margin: "2rem auto", fontFamily: "system-ui, sans-serif" }}>
        <h1>{dict.confirmTitle}</h1>
        <p>{dict.changeFailed(!knownTool ? `unknown tool "${name}"` : `invalid status "${to}"`)}</p>
        <p>
          <a href="/tools">{dict.title}</a>
        </p>
      </main>
    );
  }

  const statusLabel = to === "active" ? dict.active : dict.disabled;

  return (
    <main style={{ maxWidth: 640, margin: "2rem auto", fontFamily: "system-ui, sans-serif" }}>
      <h1>{dict.confirmTitle}</h1>
      <p>{dict.confirmPendingChange(name, statusLabel)}</p>
      <p>{dict.warningNotice}</p>
      <form method="POST" action={`/tools/${encodeURIComponent(name)}/status`} style={{ display: "flex", gap: 8 }}>
        <input type="hidden" name="to" value={to} />
        <button type="submit">{dict.confirmButton}</button>
        <a href="/tools">{dict.cancelButton}</a>
      </form>
    </main>
  );
}
