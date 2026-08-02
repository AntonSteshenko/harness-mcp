import type { CSSProperties } from "react";
import { redirect } from "next/navigation";
import { hasActiveOwnerSession } from "@/lib/oauth/session";
import { getRecord, listRecords } from "@/lib/oauth/store";
import type { AuthorizationGrant, RegisteredClient } from "@/lib/oauth/types";
import { resolveLanguage } from "@/lib/i18n/resolve";
import { getDictionary } from "@/lib/i18n/dictionaries";

const cellStyle: CSSProperties = { textAlign: "left", padding: "0.5rem", borderBottom: "1px solid #ddd" };

/** Lists every connected client and lets the owner revoke one (FR-006, FR-007). */
export default async function ConnectedAppsPage() {
  const signedIn = await hasActiveOwnerSession();
  if (!signedIn) {
    redirect(`/oauth/login?continue=${encodeURIComponent("/settings/connected-apps")}`);
  }

  const grants = await listRecords<AuthorizationGrant>("grants/");
  const rows = await Promise.all(
    grants
      .sort((a, b) => b.authorizedAt.localeCompare(a.authorizedAt))
      .map(async (grant) => ({
        grant,
        client: await getRecord<RegisteredClient>(`clients/${grant.clientId}`),
      })),
  );

  const dict = getDictionary(await resolveLanguage()).settings.connectedApps;

  return (
    <main style={{ maxWidth: 720, margin: "2rem auto", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1>{dict.title}</h1>
        <form method="POST" action="/oauth/logout">
          <button type="submit">{dict.signOut}</button>
        </form>
      </div>
      {rows.length === 0 ? (
        <p>{dict.empty}</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={cellStyle}>{dict.client}</th>
              <th style={cellStyle}>{dict.status}</th>
              <th style={cellStyle}>{dict.authorized}</th>
              <th style={cellStyle}>{dict.lastUsed}</th>
              <th style={cellStyle} />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ grant, client }) => (
              <tr key={grant.grantId}>
                <td style={cellStyle}>{client?.clientName ?? grant.clientId}</td>
                <td style={cellStyle}>{grant.status}</td>
                <td style={cellStyle}>{new Date(grant.authorizedAt).toLocaleString()}</td>
                <td style={cellStyle}>{grant.lastUsedAt ? new Date(grant.lastUsedAt).toLocaleString() : dict.never}</td>
                <td style={cellStyle}>
                  {grant.status === "active" && (
                    <form method="POST" action={`/settings/connected-apps/${grant.grantId}/revoke`}>
                      <button type="submit">{dict.revoke}</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
