import type { CSSProperties } from "react";
import { redirect } from "next/navigation";
import { hasActiveOwnerSession } from "@/lib/oauth/session";
import { listPersonalAccessTokens } from "@/lib/oauth/personalAccessTokens";

const cellStyle: CSSProperties = { textAlign: "left", padding: "0.5rem", borderBottom: "1px solid #ddd" };

/** Lists every personal access token, lets the owner create or revoke one (FR-001, FR-005, FR-006). */
export default async function PersonalAccessTokensPage() {
  const signedIn = await hasActiveOwnerSession();
  if (!signedIn) {
    redirect(`/oauth/login?continue=${encodeURIComponent("/settings/personal-access-tokens")}`);
  }

  const tokens = await listPersonalAccessTokens();

  return (
    <main style={{ maxWidth: 720, margin: "2rem auto", fontFamily: "system-ui, sans-serif" }}>
      <h1>Personal access tokens</h1>
      <p>Use a personal access token as a bearer credential for MCP clients that can&apos;t complete an OAuth sign-in.</p>

      {tokens.length === 0 ? (
        <p>No personal access tokens yet.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={cellStyle}>Name</th>
              <th style={cellStyle}>Status</th>
              <th style={cellStyle}>Created</th>
              <th style={cellStyle}>Last used</th>
              <th style={cellStyle} />
            </tr>
          </thead>
          <tbody>
            {tokens
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .map((token) => (
                <tr key={token.id}>
                  <td style={cellStyle}>{token.name}</td>
                  <td style={cellStyle}>{token.revoked ? "revoked" : "active"}</td>
                  <td style={cellStyle}>{new Date(token.createdAt).toLocaleString()}</td>
                  <td style={cellStyle}>{token.lastUsedAt ? new Date(token.lastUsedAt).toLocaleString() : "never"}</td>
                  <td style={cellStyle}>
                    {!token.revoked && (
                      <form method="POST" action={`/settings/personal-access-tokens/${token.id}/revoke`}>
                        <button type="submit">Revoke</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      )}

      <h2>Create a new token</h2>
      <form method="POST" action="/settings/personal-access-tokens/create" style={{ display: "flex", gap: 8 }}>
        <input type="text" name="name" placeholder="Name (e.g. laptop, ci script)" required style={{ flex: 1 }} />
        <button type="submit">Generate token</button>
      </form>
    </main>
  );
}
