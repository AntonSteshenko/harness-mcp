import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * Instructions for connecting Claude/ChatGPT to the MCP server via OAuth
 * (spec 008-mcp-oauth) — shown once the Company OS structure exists,
 * replacing the old "link to /editor only" confirmation (2026-07-25
 * revision). Static content, no interactivity needed. Translated via `dict`
 * (spec 015 FR-008) — mid-sentence file/path mentions are plain text rather
 * than `<code>` elements so the translated sentences don't have to be split
 * around inline markup.
 */
export function McpConnectManual({
  mcpUrl,
  justCreated,
  dict,
}: {
  mcpUrl: string;
  justCreated: boolean;
  dict: Dictionary["init"]["mcpConnect"];
}) {
  return (
    <>
      <h1>{justCreated ? dict.readyTitle : dict.connectTitle}</h1>
      {justCreated && <p>{dict.justCreatedText}</p>}

      <ol>
        <li>
          {dict.step1}
          <pre>{mcpUrl}</pre>
        </li>
        <li>{dict.step2}</li>
        <li>{dict.step3}</li>
      </ol>

      <p>{dict.reviewText}</p>

      <p>
        <a href="/files">{dict.goToEditor}</a>
      </p>
    </>
  );
}
