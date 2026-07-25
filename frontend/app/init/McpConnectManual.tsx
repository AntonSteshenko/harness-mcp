/**
 * Instructions for connecting Claude/ChatGPT to the MCP server via OAuth
 * (spec 008-mcp-oauth) — shown once the Company OS structure exists,
 * replacing the old "link to /editor only" confirmation (2026-07-25
 * revision). Static content, no interactivity needed.
 */
export function McpConnectManual({ mcpUrl, justCreated }: { mcpUrl: string; justCreated: boolean }) {
  return (
    <>
      <h1>{justCreated ? "Your Company OS is ready" : "Connect Claude or ChatGPT"}</h1>
      {justCreated && (
        <p>
          The starting structure (<code>os/</code>, <code>data/</code>, <code>AGENTS.md</code>,{" "}
          <code>os/skills/init.md</code>) has been created. Connect an AI assistant below, then
          ask it to read <code>os/skills/init.md</code> — it will interview you and set up the
          rest.
        </p>
      )}

      <ol>
        <li>
          In Claude or ChatGPT&apos;s &quot;add connector&quot;/&quot;add MCP server&quot; flow,
          enter:
          <pre>{mcpUrl}</pre>
        </li>
        <li>
          The assistant discovers the OAuth flow automatically — sign in with your owner
          credential when prompted, then approve the connection.
        </li>
        <li>
          Once connected, ask the assistant to read <code>os/skills/init.md</code> to get
          started.
        </li>
      </ol>

      <p>
        Review or revoke connected assistants at{" "}
        <a href="/settings/connected-apps">/settings/connected-apps</a>. For scripts/CLI tools
        instead of a hosted assistant, use a{" "}
        <a href="/settings/personal-access-tokens">personal access token</a> instead of OAuth.
      </p>

      <p>
        <a href="/editor">Go to /editor</a>
      </p>
    </>
  );
}
