import type { CSSProperties } from "react";
import { redirect } from "next/navigation";
import { hasActiveOwnerSession } from "@/lib/oauth/session";
import { TOOL_CATALOG } from "@/lib/mcp-tools/catalog";
import { isToolEnabled } from "@/lib/mcp-tools/toolGate";
import { resolveLanguage } from "@/lib/i18n/resolve";
import { getDictionary } from "@/lib/i18n/dictionaries";

const cellStyle: CSSProperties = { textAlign: "left", padding: "0.5rem", borderBottom: "1px solid #ddd" };

/** Lists every MCP tool and its current active/disabled status (spec 024, spec 023). */
export default async function ToolsPage() {
  const signedIn = await hasActiveOwnerSession();
  if (!signedIn) {
    redirect(`/oauth/login?continue=${encodeURIComponent("/tools")}`);
  }

  const rows = TOOL_CATALOG.map((tool) => ({ ...tool, enabled: isToolEnabled(tool.name) })).sort(
    (a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name),
  );

  const dict = getDictionary(await resolveLanguage()).tools;

  return (
    <main style={{ maxWidth: 720, margin: "2rem auto", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1>{dict.title}</h1>
        <form method="POST" action="/oauth/logout">
          <button type="submit">{dict.signOut}</button>
        </form>
      </div>
      <p>{dict.description}</p>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={cellStyle}>{dict.name}</th>
            <th style={cellStyle}>{dict.group}</th>
            <th style={cellStyle}>{dict.status}</th>
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
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
