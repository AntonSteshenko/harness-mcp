import type { CSSProperties } from "react";
import { redirect } from "next/navigation";
import { hasActiveOwnerSession } from "@/lib/oauth/session";
import { TOOL_CATALOG } from "@/lib/mcp-tools/catalog";
import { getDisabledTools } from "@/lib/mcp-tools/store";
import { resolveLanguage } from "@/lib/i18n/resolve";
import { getDictionary } from "@/lib/i18n/dictionaries";

const cellStyle: CSSProperties = { textAlign: "left", padding: "0.5rem", borderBottom: "1px solid #ddd" };

/** Lists every MCP tool, its current active/disabled status, and lets the owner change it (spec 024, spec 025). */
export default async function ToolsPage({
  searchParams,
}: {
  searchParams: Promise<{ changed?: string; to?: string }>;
}) {
  const signedIn = await hasActiveOwnerSession();
  if (!signedIn) {
    redirect(`/oauth/login?continue=${encodeURIComponent("/tools")}`);
  }

  const { changed, to } = await searchParams;
  const disabledTools = await getDisabledTools();

  const rows = TOOL_CATALOG.map((tool) => ({ ...tool, enabled: !disabledTools.has(tool.name) })).sort(
    (a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name),
  );

  const dict = getDictionary(await resolveLanguage()).tools;
  const changedStatusLabel = to === "active" ? dict.active : to === "disabled" ? dict.disabled : undefined;

  return (
    <main style={{ maxWidth: 720, margin: "2rem auto", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1>{dict.title}</h1>
        <form method="POST" action="/oauth/logout">
          <button type="submit">{dict.signOut}</button>
        </form>
      </div>
      <p>{dict.description}</p>
      {changed && changedStatusLabel && (
        <div style={{ border: "1px solid #ddd", borderRadius: 6, padding: "0.75rem 1rem", marginBottom: "1rem" }}>
          <p style={{ margin: 0 }}>{dict.changedBanner(changed, changedStatusLabel)}</p>
          <p style={{ margin: "0.5rem 0 0" }}>{dict.warningNotice}</p>
        </div>
      )}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={cellStyle}>{dict.name}</th>
            <th style={cellStyle}>{dict.group}</th>
            <th style={cellStyle}>{dict.status}</th>
            <th style={cellStyle} />
          </tr>
        </thead>
        <tbody>
          {rows.map((tool) => (
            <tr key={tool.name}>
              <td style={cellStyle}>
                <code>{tool.name}</code>
              </td>
              <td style={cellStyle}>{tool.group}</td>
              <td style={cellStyle}>{tool.enabled ? dict.active : dict.disabled}</td>
              <td style={cellStyle}>
                <a href={`/tools/${encodeURIComponent(tool.name)}/confirm?to=${tool.enabled ? "disabled" : "active"}`}>
                  {tool.enabled ? dict.disableAction : dict.enableAction}
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
