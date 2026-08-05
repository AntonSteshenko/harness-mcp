# Quickstart: Manage Tools From The Page

**Input**: [spec.md](./spec.md), [contracts/manage-tools-routes.md](./contracts/manage-tools-routes.md)

This guide validates the feature end-to-end against the acceptance scenarios in spec.md. It assumes this feature is implemented per tasks.md, and that spec 024's `/tools` page already exists.

## Prerequisites

1. The spec 001 local storage stack is running: from the repo root, `docker compose up -d`.
2. Dependencies installed: `cd frontend && npm install`.
3. `frontend/.env.local` set up per the repo root `README.md`. Make sure `MCP_DISABLED_TOOLS` is **unset** — this feature no longer reads it (research.md §7).
4. The dev server running: `npm run dev` (`http://localhost:3000`).
5. A browser, signed in as owner at `/tools`.

## 1. Disable a tool, with confirmation (validates User Story 1, FR-001, FR-002, FR-003, SC-001, SC-002)

On `/tools`, choose to disable an active tool (e.g. `send_email`).

Expected: you land on a confirmation screen naming `send_email` and stating it's about to become disabled — nothing has changed yet.

Reload that confirmation screen, or navigate away without submitting.

Expected: back on `/tools`, `send_email` still shows active — nothing was applied.

Return to the confirmation screen and submit it.

Expected: redirected to `/tools`; `send_email` now shows disabled.

## 2. The not-instant warning appears every time (validates User Story 2, FR-004, FR-005, SC-004)

Immediately after step 1's submission.

Expected: a clear, prominent notice on `/tools` states that already-connected AI assistant sessions may not see this change until they reconnect.

Repeat step 1 for a second tool (e.g. re-enable a different, already-disabled one, or disable `send_telegram_message`).

Expected: the same notice appears again for this second change — not just the first time.

## 3. The change is live for the next MCP request, no restart (validates User Story 3, FR-006, FR-007, FR-009, SC-003)

With `send_email` disabled (from step 1) and the dev server still running (no restart), connect an MCP client (or call `tools/list` directly) against `http://localhost:3000/mcp`.

Expected: `send_email` is absent from the tool list — the change took effect without restarting anything.

Reload `/tools` (a fresh page load, not the redirect from step 1).

Expected: `send_email` still shows disabled — the status persists across visits, matching what the live server sees.

## 4. Only the signed-in owner can change anything (validates FR-008, SC-005)

In a private/incognito window (no owner session), attempt to `POST` directly to `/tools/send_email/status` (e.g. via a saved form or a tool like `curl -X POST`).

Expected: rejected with an unauthorized error; `send_email`'s status is unchanged.

Attempt to load `/tools/send_email/confirm?to=disabled` the same way.

Expected: redirected to sign in; no tool information is shown.

## 5. Invalid change attempts are rejected clearly (validates FR-010, Edge Cases)

Signed in as owner, attempt `/tools/not_a_real_tool/confirm?to=disabled`.

Expected: a clear rejection — no confirmation screen offering to "disable" a tool that doesn't exist.

## Cleanup

From `/tools`, re-enable any tool you disabled during this walkthrough, following the same confirm-then-apply flow.
