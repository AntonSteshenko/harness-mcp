import type { CSSProperties } from "react";
import { redirect } from "next/navigation";
import { hasActiveOwnerSession } from "@/lib/oauth/session";
import { getRecord, listRecords } from "@/lib/oauth/store";
import type { AuthorizationGrant, RegisteredClient } from "@/lib/oauth/types";

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

  return (
    <main style={{ maxWidth: 720, margin: "2rem auto", fontFamily: "system-ui, sans-serif" }}>
      <h1>Connected apps</h1>
      {rows.length === 0 ? (
        <p>No AI assistants are connected yet.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={cellStyle}>Client</th>
              <th style={cellStyle}>Status</th>
              <th style={cellStyle}>Authorized</th>
              <th style={cellStyle}>Last used</th>
              <th style={cellStyle} />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ grant, client }) => (
              <tr key={grant.grantId}>
                <td style={cellStyle}>{client?.clientName ?? grant.clientId}</td>
                <td style={cellStyle}>{grant.status}</td>
                <td style={cellStyle}>{new Date(grant.authorizedAt).toLocaleString()}</td>
                <td style={cellStyle}>{grant.lastUsedAt ? new Date(grant.lastUsedAt).toLocaleString() : "never"}</td>
                <td style={cellStyle}>
                  {grant.status === "active" && (
                    <form method="POST" action={`/settings/connected-apps/${grant.grantId}/revoke`}>
                      <button type="submit">Revoke</button>
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
