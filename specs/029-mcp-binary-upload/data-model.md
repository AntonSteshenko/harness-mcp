# Phase 1 Data Model: MCP Binary File Upload Tool

This feature adds no new persisted entity — it adds two new *entry points* (MCP tool calls) into the same "Stored File" entity spec 028 already defined, plus one new error code. No changes to `FileMetadata`/`FileContent` (`lib/storage/files.ts`) or the "File Type Category" table (`lib/storage/fileTypes.ts`) — both are reused exactly as spec 028 built them.

## Binary File Upload Request (new — tool input, not persisted)

The input to `create_binary_file`. Exists only for the duration of one tool call.

| Field | Type | Notes |
|---|---|---|
| `path` | `string` | Target storage path — same meaning as every other file tool's `path` (spec 001/002). |
| `content` | `string` | Base64-encoded file content. Validated against a strict base64 pattern (research.md §2) before decoding; the decoded `Buffer` is what actually reaches `createFile`. |

Decodes, once validated, into the same **Stored File** entity spec 028 defined (`path`, raw `Buffer` content, `contentType` inferred the same way, `size`, `lastModified`, `etag`) — this feature does not extend that entity's shape.

## Binary-Safe Read Result (new — tool output, not persisted)

The response shape of `read_binary_file`.

| Field | Type | Notes |
|---|---|---|
| `path` | `string` | Echoes the requested path. |
| `content` | `string` | Base64-encoded exact file bytes (`Buffer.toString("base64")`) — decodes back to the original file exactly. |
| `size` | `number` | Byte length of the *decoded* (original) content, not the base64 string's length — consistent with how `size` is reported everywhere else in this codebase. |
| `lastModified` | `string` (ISO 8601) | Unchanged meaning from `FileMetadata`. |
| `etag` | `string` | Unchanged meaning from `FileMetadata`. |
| `contentType` | `string` | Unchanged meaning from `FileMetadata` (spec 028). |

Same fields as the existing `read_file` tool's result (`FileContent`), except `content` is base64 rather than decoded UTF-8 text — deliberately kept parallel in shape so an agent already familiar with `read_file`'s response only has to learn one thing about `read_binary_file`: that `content` needs a base64 decode.

## `read_file`'s new binary-rejection result (existing tool, changed behavior)

When `read_file` is called on a file the shared binary guard (research.md §4) identifies as binary, it now returns an `errorResult` with `code: "invalid_content"` instead of `ok({...content as corrupted text})`. No new entity — this is the existing `{code, message}` error envelope every tool already uses on failure, just a new code value reaching it for this specific case.

## StorageErrorCode (extends the enum spec 028 already extended)

| Code | HTTP status (web routes) | When |
|---|---|---|
| `not_found` | 404 | Unchanged. |
| `type_mismatch` | 404 | Unchanged. |
| `already_exists` | 409 | Unchanged. |
| `storage_unreachable` | 502 | Unchanged. |
| `unsupported_type` | 415 | Unchanged (spec 028) — also reused by `create_binary_file` (FR-006). |
| `too_large` | 413 | Unchanged (spec 028) — also reused by `create_binary_file` (FR-007). |
| `invalid_content` | 400 | **New** — the provided content isn't valid base64 (FR-003), or (via `read_file`'s new guard) the requested file is binary and can't be returned as text (FR-010). |

The HTTP-status column only matters for the web routes (`app/api/file/route.ts` etc.) whose `STATUS_BY_CODE: Record<StorageError["code"], number>` maps must stay total over every code in the union — MCP tool errors carry `{code, message}` directly with no HTTP status involved (`lib/mcp-tools/result.ts`'s `errorResult`).
