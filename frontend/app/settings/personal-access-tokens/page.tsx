import type { CSSProperties } from "react";
import { redirect } from "next/navigation";
import { hasActiveOwnerSession } from "@/lib/oauth/session";
import { listPersonalAccessTokens } from "@/lib/oauth/personalAccessTokens";
import { resolveLanguage } from "@/lib/i18n/resolve";
import { getDictionary } from "@/lib/i18n/dictionaries";

const cellStyle: CSSProperties = { textAlign: "left", padding: "0.5rem", borderBottom: "1px solid #ddd" };

/** Lists every personal access token, lets the owner create or revoke one (FR-001, FR-005, FR-006). */
export default async function PersonalAccessTokensPage() {
  const signedIn = await hasActiveOwnerSession();
  if (!signedIn) {
    redirect(`/oauth/login?continue=${encodeURIComponent("/settings/personal-access-tokens")}`);
  }

  const tokens = await listPersonalAccessTokens();
  const dict = getDictionary(await resolveLanguage()).settings.pat;

  return (
    <main style={{ maxWidth: 720, margin: "2rem auto", fontFamily: "system-ui, sans-serif" }}>
      <h1>{dict.title}</h1>
      <p>{dict.description}</p>

      {tokens.length === 0 ? (
        <p>{dict.empty}</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={cellStyle}>{dict.name}</th>
              <th style={cellStyle}>{dict.status}</th>
              <th style={cellStyle}>{dict.created}</th>
              <th style={cellStyle}>{dict.lastUsed}</th>
              <th style={cellStyle} />
            </tr>
          </thead>
          <tbody>
            {tokens
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .map((token) => (
                <tr key={token.id}>
                  <td style={cellStyle}>{token.name}</td>
                  <td style={cellStyle}>{token.revoked ? dict.revoked : dict.active}</td>
                  <td style={cellStyle}>{new Date(token.createdAt).toLocaleString()}</td>
                  <td style={cellStyle}>{token.lastUsedAt ? new Date(token.lastUsedAt).toLocaleString() : dict.never}</td>
                  <td style={cellStyle}>
                    {!token.revoked && (
                      <form method="POST" action={`/settings/personal-access-tokens/${token.id}/revoke`}>
                        <button type="submit">{dict.revoke}</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      )}

      <h2>{dict.createTitle}</h2>
      <form method="POST" action="/settings/personal-access-tokens/create" style={{ display: "flex", gap: 8 }}>
        <input type="text" name="name" placeholder={dict.namePlaceholder} required style={{ flex: 1 }} />
        <button type="submit">{dict.generate}</button>
      </form>
    </main>
  );
}
