# Quickstart: MCP Tool Toggle

**Input**: [spec.md](./spec.md), [contracts/mcp-tool-toggle-config.md](./contracts/mcp-tool-toggle-config.md)

This guide validates the feature end-to-end against the acceptance scenarios in spec.md. It assumes `MCP_DISABLED_TOOLS` gating has been implemented per tasks.md.

## Prerequisites

1. The spec 001 local storage stack is running: from the repo root, `docker compose up -d`.
2. Dependencies installed: `cd frontend && npm install`.
3. An MCP client capable of connecting over Streamable HTTP, pointed at `http://localhost:3000/mcp`, already authenticated (OAuth or personal access token per spec 008/013).

## 1. Baseline — no configuration set (validates User Story 3, FR-002, SC-002)

Make sure `MCP_DISABLED_TOOLS` is absent (or commented out) from `frontend/.env.local`, then start the dev server: `npm run dev`.

Call `tools/list`.

Expected: all 17 tools are present (the 8 core file/directory tools, 3 engine tools, 2 messaging tools, `get_inbox`, and the 3 tree-search tools) — identical to the tool set before this feature existed.

## 2. Disable a single tool (validates User Story 1, FR-001, FR-003, FR-004, SC-001)

Stop the dev server. Set in `frontend/.env.local`:

```
MCP_DISABLED_TOOLS=send_email
```

Restart: `npm run dev`.

Call `tools/list`.

Expected: `send_email` is absent from the result. Every other tool — including `send_telegram_message` — is still present.

Call `send_email` directly with any arguments (e.g. `{ to: ["test@example.com"], subject: "x", body: "x" }`).

Expected: the call fails with the same "unknown tool" error the client would show for calling a tool name that was never part of this server at all — not a distinct "tool disabled" message.

## 3. Disable several tools at once (validates User Story 2, FR-007, SC-003)

Stop the dev server. Set:

```
MCP_DISABLED_TOOLS=send_email, send_telegram_message
```

(note the space after the comma, to confirm whitespace is trimmed). Restart.

Call `tools/list`.

Expected: neither `send_email` nor `send_telegram_message` appears; every other tool does.

## 4. Unknown name in the list is ignored (validates FR-005, SC-004)

Stop the dev server. Set:

```
MCP_DISABLED_TOOLS=send_email,not_a_real_tool
```

Restart.

Expected: the server starts normally (no crash, no startup error). Call `tools/list`: `send_email` is absent, every other real tool is present — `not_a_real_tool` had no effect on anything.

## 5. Disable everything (extreme edge case, validates SC-003)

Stop the dev server. Set `MCP_DISABLED_TOOLS` to the full comma-separated list of all 17 tool names from [contracts/mcp-tool-toggle-config.md](./contracts/mcp-tool-toggle-config.md). Restart.

Expected: the server starts successfully. Call `tools/list`: the result is empty.

## Cleanup

Remove or clear `MCP_DISABLED_TOOLS` from `frontend/.env.local` and restart the dev server to restore the full tool set.
