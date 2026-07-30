# Quickstart: Validate the Dedicated Inbox MCP Tool

Manual validation guide (this project has no automated test suite — see `research.md` §3 in prior specs' convention). Run these scenarios against a running `next dev` instance after implementation, using an MCP client or `curl` against `/mcp` (as in spec 013's quickstart).

## Prerequisites

- MinIO/S3-compatible storage stack running and configured (spec 001).
- `frontend`: `npm install && npm run dev`.
- An MCP session already authenticated (OAuth or personal access token, specs 008/013) so `tools/call` requests succeed.

## Scenario 1 — Read an inbox that has content (US1, FR-001, FR-003, SC-001, SC-002)

1. Ensure `data/inbox.md` exists with some captured lines (create it via `create_file` if needed, e.g. `# Inbox\n\n- 2026-07-30 call the supplier back`).
2. Call `get_inbox` with `{}`.
3. **Expect**: the response's `content` field matches the file's actual current content exactly, with no path argument required.

## Scenario 2 — Read a freshly-emptied inbox (US1, spec.md Acceptance Scenario US1.2)

1. Update `data/inbox.md` to just its header (e.g. `# Inbox`), simulating the state right after a weekly review.
2. Call `get_inbox`.
3. **Expect**: success, with `content` equal to the header only — not an error.

## Scenario 3 — Content reflects the latest edit, not a stale copy (US1, FR-003, Acceptance Scenario US1.3)

1. Call `get_inbox` and note the returned `content`.
2. Edit `data/inbox.md` (e.g. via `update_file`) to add a new line.
3. Call `get_inbox` again.
4. **Expect**: the second call's `content` includes the new line — proving no caching between calls.

## Scenario 4 — Inbox does not exist yet (US2, FR-004, SC-003)

1. Ensure `data/inbox.md` does not exist (delete it, or use a storage account/bucket prefix where the OS was never initialized).
2. Call `get_inbox`.
3. **Expect**: `isError: true` with `code: "not_found"` — distinguishable from a generic failure.

## Scenario 5 — Storage unreachable is distinguishable from not-found (FR-005, Edge Cases)

1. Temporarily point the S3 endpoint config at an unreachable host and restart `next dev`.
2. Call `get_inbox`.
3. **Expect**: `isError: true` with `code: "storage_unreachable"` — confirm this is a different `code` value than Scenario 4's `not_found`.
4. Restore the correct S3 endpoint config and restart.

## Scenario 6 — Tool is read-only (FR-002)

1. Call `get_inbox` and note `data/inbox.md`'s `lastModified`/`etag` from the response.
2. Call `get_inbox` again immediately.
3. **Expect**: `lastModified`/`etag` are unchanged between the two calls — confirming the tool performed no write.
