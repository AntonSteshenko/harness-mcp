# Quickstart: Dynamic Tool Descriptions from a Single Bootstrap File

**Input**: [spec.md](spec.md), [contracts/tool-description-framing.md](contracts/tool-description-framing.md), [data-model.md](data-model.md)

This guide validates the feature end-to-end against spec.md's acceptance scenarios. It assumes `lib/mcp-tools/bootstrap.ts` has been added and `lib/mcp-tools/index.ts`'s `registerTools()` calls it per tasks.md.

## Prerequisites

1. The storage backend is running and configured per spec 007 (`docker compose up -d` from the repo root; `frontend/.env.local` set up).
2. Dependencies installed: `npm install` from `frontend/`.
3. `npm run dev` from `frontend/`, so the MCP endpoint is reachable at `http://localhost:3000/mcp`.
4. An MCP client capable of listing tools (e.g. `npx @modelcontextprotocol/inspector http://localhost:3000/mcp`, or any connected chat client), or plain `curl` issuing a raw `tools/list` JSON-RPC POST.

## 1. Framing appears when both markers are present (validates User Story 1, FR-006, FR-007, SC-003)

1. Create (or update) the bootstrap file in storage at the path you'll configure below, e.g.:
   ```md
   <!-- mcp-context: Assistant OS -->
   <!-- mcp-triggers: apri, chiudi, review, task, idea, progetto, cliente, lead, cosa faccio oggi, stato progetti -->

   # Assistant OS bootstrap
   ...
   ```
2. Set `MCP_BOOTSTRAP_PATH=assistant/AGENTS.md` in `frontend/.env.local` and restart `npm run dev`.
3. Call `tools/list` against `http://localhost:3000/mcp`.
   Expected: `read_file` and `list_directory`'s descriptions begin with "Access to Assistant OS: a Markdown store. Use it when the user wants: apri, chiudi, ...", followed by their original description text unchanged. `create_file`, `update_file`, `move`, `create_directory`, `delete_directory`, and `delete_file`'s descriptions begin with "Part of Assistant OS. Before writing, follow assistant/AGENTS.md.", followed by their original text unchanged.

## 2. Editing the bootstrap file updates descriptions without a redeploy (validates User Story 2, SC-001)

1. With the dev server still running from step 1, edit the bootstrap file's `mcp-triggers` marker in storage (e.g. add a new trigger phrase), without restarting `npm run dev`.
2. Wait up to ~1 minute (the TTL cache window), then call `tools/list` again.
   Expected: the entry tools' descriptions reflect the updated trigger list.

## 3. Tool listing never breaks (validates User Story 3, FR-009, SC-002)

Repeat `tools/list` after each of the following changes, restarting `npm run dev` when an env var changes:

1. Remove `MCP_BOOTSTRAP_PATH` entirely from `.env.local`.
   Expected: all 8 tools returned with their original, unmodified descriptions; no error.
2. Set `MCP_BOOTSTRAP_PATH` to a path that does not exist in storage.
   Expected: same as above.
3. Point `MCP_BOOTSTRAP_PATH` at a real file containing neither marker (plain Markdown with no HTML comments).
   Expected: same as above.
4. Point `MCP_BOOTSTRAP_PATH` at a file containing only `mcp-context` (no `mcp-triggers`), then only `mcp-triggers` (no `mcp-context`).
   Expected: entry tools' descriptions use whichever piece of information is present, degrading gracefully per contracts/tool-description-framing.md's precedence table; no error in either case.

## 4. Unchanged tool behavior (validates FR-008, SC-004)

1. With any bootstrap-file state from steps 1–3, call an actual tool (e.g. `read_file` with a known path, or `list_directory` with `""`).
   Expected: the call succeeds/fails exactly as it did before this feature — the `inputSchema` and result shape are untouched; only the `description` shown in `tools/list` changed.
