# Quickstart: Tools Status Page

**Input**: [spec.md](./spec.md), [contracts/tools-page.md](./contracts/tools-page.md)

This guide validates the feature end-to-end against the acceptance scenarios in spec.md. It assumes the `/tools` page has been implemented per tasks.md, and that spec 023's `MCP_DISABLED_TOOLS` mechanism is already in place.

## Prerequisites

1. The spec 001 local storage stack is running: from the repo root, `docker compose up -d`.
2. Dependencies installed: `cd frontend && npm install`.
3. `frontend/.env.local` set up per the repo root `README.md`, including `OAUTH_OWNER_USERNAME`/`OAUTH_OWNER_PASSWORD`.
4. The dev server running: `npm run dev` (`http://localhost:3000`).
5. A browser (this is an HTML page, not an MCP tool — no MCP client needed).

## 1. Unauthenticated visitor is redirected (validates User Story 2, FR-003, FR-004, SC-003)

In a private/incognito browser window (no existing owner session), navigate to `http://localhost:3000/tools`.

Expected: redirected to `/oauth/login?continue=%2Ftools`, with no tool names or statuses visible anywhere on the page (view page source to confirm — nothing tool-related is present).

Sign in with the configured owner credentials.

Expected: landed back on `/tools` (not `/settings/connected-apps` or any other default) — the original destination is preserved through sign-in.

## 2. Every tool listed, all active by default (validates User Story 1, FR-001, FR-002, FR-006, SC-001, SC-002)

Ensure `MCP_DISABLED_TOOLS` is unset in `frontend/.env.local`, then (re)start `npm run dev`. Signed in as owner, load `/tools`.

Expected: all 17 tools are listed — `create_file`, `read_file`, `delete_file`, `create_directory`, `list_directory`, `delete_directory`, `update_file`, `move`, `get_os_engine`, `get_os_upgrade`, `get_os_init`, `send_email`, `send_telegram_message`, `get_inbox`, `list_directory_tree`, `find_files_by_name`, `search_file_content` — each clearly marked active/enabled.

## 3. Disabled tools are shown, not hidden (validates User Story 1, FR-002, FR-006, Edge Cases)

Stop the dev server. Set `MCP_DISABLED_TOOLS=send_email,send_telegram_message` in `frontend/.env.local`. Restart.

Reload `/tools`.

Expected: `send_email` and `send_telegram_message` are still listed, but each is clearly marked disabled. All 15 other tools are still marked active. Total row count is still 17.

## 4. The page reflects the current configuration after a restart (validates User Story 3, FR-005, SC-004)

With the dev server from step 3 still configured (two tools disabled), stop it. Remove `MCP_DISABLED_TOOLS` from `frontend/.env.local` entirely. Restart.

Reload `/tools` (a normal reload, no cache-busting query string or hard refresh required).

Expected: all 17 tools now show active again — no leftover "disabled" marking from the previous configuration.

## 5. Unknown name in the deny-list has no visible effect (validates User Story 3, FR-002, spec 023 FR-005)

Stop the dev server. Set `MCP_DISABLED_TOOLS=send_email,not_a_real_tool`. Restart.

Reload `/tools`.

Expected: exactly 17 rows, same as always — `send_email` marked disabled, everything else active. No 18th row or any entry for `not_a_real_tool` appears.

## Cleanup

Remove or clear `MCP_DISABLED_TOOLS` from `frontend/.env.local` and restart the dev server.
