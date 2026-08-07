# Quickstart: MCP Binary File Upload Tool

Validates the feature end-to-end against a local dev environment, using authenticated `curl` calls against the real `/mcp` JSON-RPC endpoint — the same approach spec 028's `quickstart.md` used for its API routes, since this project has no automated test suite and MCP tool calls aren't something a browser click-through can exercise directly.

## Prerequisites

```bash
docker compose up -d          # starts local MinIO (repo root)
cd frontend
npm install
npm run dev                   # http://localhost:3000 (or next available port)
```

You'll need a bearer token to call `/mcp` — either complete the OAuth connector flow (spec 008) or create a personal access token (spec 013/027) from `/settings/personal-access-tokens` after signing in as the owner.

## Scenario 1 — Upload a binary file via MCP (User Story 1, FR-001–FR-005, SC-001)

1. Base64-encode a small real binary file (e.g., a PDF or PNG): `base64 -w0 sample.pdf > sample.pdf.b64`.
2. Call `create_binary_file` with `{ path: "qa-029/sample.pdf", content: "<contents of sample.pdf.b64>" }` via an MCP `tools/call` request.
3. **Expected**: success response with `FileMetadata` (`path`, `size` matching the original file's byte length, `etag`, `contentType: "application/pdf"`).
4. Retrieve the file via the browser download action from spec 028 (`GET /api/file/download?path=qa-029/sample.pdf`) and confirm its bytes are identical to the original `sample.pdf` (SC-001).
5. Call `create_binary_file` again with the same `path` and different (but still valid) content. **Expected**: succeeds, overwriting the file — no confirmation prompt (MCP tools don't have one; this differs from the browser's overwrite-confirm UX, intentionally, per FR-004).

## Scenario 2 — Reject bad input before writing anything (FR-003, FR-006, FR-007, SC-002)

1. Call `create_binary_file` with `content: "not valid base64!!"`. **Expected**: `isError: true`, `code: "invalid_content"`.
2. Call `create_binary_file` with `path: "qa-029/malware.exe"` and any valid base64 content. **Expected**: `isError: true`, `code: "unsupported_type"`.
3. Call `create_binary_file` with a path allowed by the allow-list but base64 content decoding to over 25 MB. **Expected**: `isError: true`, `code: "too_large"`.
4. After each of the above, confirm nothing was written (e.g., via `list_directory` on `qa-029/`) — none of the rejected calls should have created or modified any file.

## Scenario 3 — Read a binary file back via MCP (User Story 2, FR-009, SC-001, SC-003)

1. Call `read_binary_file` with `{ path: "qa-029/sample.pdf" }` (from Scenario 1).
2. **Expected**: response includes `content` as base64; decode it locally (`echo "<content>" | base64 -d > roundtrip.pdf`) and confirm `roundtrip.pdf` is byte-for-byte identical to the original `sample.pdf` (SC-001).
3. This — Scenario 1 step 2 followed by this step — is the full upload-then-verify round trip using only MCP tool calls (SC-003).

## Scenario 4 — `read_file` now rejects binary cleanly instead of corrupting it (FR-010, SC-005)

1. Call the existing `read_file` tool with `{ path: "qa-029/sample.pdf" }`.
2. **Expected**: `isError: true`, `code: "invalid_content"`, with a clear message — not a success response containing garbled/replacement-character-filled text.
3. Call `read_file` on a known text file (e.g., any existing `.md` file). **Expected**: succeeds exactly as before this feature — plain text content, unchanged shape (FR-010, SC-004).

## Scenario 5 — New tools are visible and disableable on `/tools` (FR-008)

1. Sign in as the owner and open `/tools`.
2. **Expected**: `create_binary_file` and `read_binary_file` both appear, listed under "File & Directory" alongside `create_file`/`read_file`/etc.
3. Disable `create_binary_file` from that page, then attempt to call it via MCP again. **Expected**: the call fails the same way calling any other disabled or unrecognized tool name does today (absent from `tools/list`, call fails as unrecognized). Re-enable it afterward.

## Scenario 6 — Large payload doesn't get silently truncated (research.md §7)

1. Base64-encode a file close to the 25 MB limit (e.g., 24 MB).
2. Call `create_binary_file` with that content.
3. **Expected**: succeeds (not a truncated/corrupted write, and not a generic transport-level failure) — confirms `next.config.ts`'s raised `proxyClientMaxBodySize` actually clears a near-limit base64 payload over the real `/mcp` transport, not just in theory.
