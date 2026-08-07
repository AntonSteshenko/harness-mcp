# Contract: `create_binary_file` / `read_binary_file` (+ changed `read_file`)

**Input**: [spec.md](../spec.md), [data-model.md](../data-model.md), [research.md](../research.md)

**Adds (additively)**: Two new MCP tools. No existing tool is renamed or removed. **One existing tool's behavior changes**: `read_file` (spec 002) now rejects binary files with a clear error instead of silently returning UTF-8-corrupted content — its behavior for text files is unchanged (FR-010).

## Common error shape

Both new tools, and `read_file`'s new failure case, return errors the same way every tool in this server already does (`lib/mcp-tools/result.ts`'s `errorResult()`): `isError: true` with a text content block whose JSON body is `{ code, message }`. Reused codes from spec 028's `StorageErrorCode` (`already_exists`, `unsupported_type`, `too_large`, `not_found`, `type_mismatch`, `storage_unreachable`) plus one new code this feature adds:

| Code | Meaning |
|---|---|
| `invalid_content` | *(new)* Either: the provided `content` is not valid base64 (`create_binary_file`), or the requested file is binary and can't be returned as text (`read_file`'s new guard). |
| `unsupported_type` | *(spec 028)* The target path's extension is outside the allow-list `lib/storage/fileTypes.ts` defines — identical list to the browser upload. |
| `too_large` | *(spec 028)* Decoded content exceeds 25 MB — identical cap to the browser upload. |
| `already_exists` | *(spec 002)* The target path is occupied by a directory. |

## `create_binary_file`

Writes base64-encoded binary content to storage, decoded to raw bytes.

- **Input**: `{ path: string, content: string }` — `content` is base64-encoded file content.
- **Output**: On success, the same shape `create_file` already returns — `FileMetadata` (`path`, `size`, `lastModified`, `etag`, `contentType`) — `size` reflects the *decoded* byte length.
- **Behavior**: Creates the file if `path` is free; overwrites it if a file already exists there; fails `already_exists` if a directory occupies `path` — identical semantics to `create_file` (Clarification: one tool, not a create/update pair).
- **Validation order** (each step short-circuits the next — nothing is written to storage unless every check passes):
  1. `content` is valid base64 → else `invalid_content`.
  2. `path`'s extension is on the allow-list → else `unsupported_type`.
  3. Decoded content is ≤ 25 MB → else `too_large`.
  4. `path` is not occupied by a directory → else `already_exists`.
- **Satisfies**: spec 029 FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-011.

## `read_binary_file`

Reads a file's exact bytes back as base64 — the read-side counterpart to `create_binary_file`, and the only MCP tool that can retrieve a binary file's actual content (`read_file` now refuses).

- **Input**: `{ path: string }`.
- **Output**: `{ path: string, content: string, size: number, lastModified: string, etag: string, contentType: string }` — `content` is base64-encoded; decodes back to the file's exact original bytes. Works for *any* stored file, text or binary — reading a text file through this tool also succeeds (its base64 content just decodes to that same text), though `read_file` remains the natural choice for text.
- **Errors**: `not_found`, `type_mismatch` (path is a directory), `storage_unreachable` — same conventions as `read_file`. No allow-list or size check on read (only uploads are gated; anything already successfully stored can be read back regardless of type).
- **Satisfies**: spec 029 FR-009.

## `read_file` (changed)

- **Unchanged for text files**: same `{ path, content, size, lastModified, etag, contentType }` shape, `content` as plain UTF-8 text — no caller-visible change (FR-010, SC-004).
- **New for binary files**: fails with `invalid_content` instead of returning corrupted text. Uses the same binary-detection logic (extension list + content-sniffing fallback) `GET /api/file` already applies (research.md §4), now shared via `lib/storage/binaryDetection.ts` rather than duplicated.
- **Satisfies**: spec 029 FR-010, SC-005.

## Cross-cutting

- Both new tools are registered the same way every other tool is — subject to the existing per-tool enable/disable mechanism (spec 023/024) and bootstrap description framing (spec 010) — and are listed in `lib/mcp-tools/catalog.ts` under `"File & Directory"` (FR-008).
- Neither new tool verifies that decoded content actually matches its declared path's extension — the extension alone drives allow-list and MIME-type handling, identical to the browser upload (FR-011).
- No batch/multi-file variant — one file per call, mirroring every existing single-file tool (spec.md Edge Cases).
- The allow-list and 25 MB cap are not redefined here — both tools call the exact same `lib/storage/fileTypes.ts` functions `app/api/upload/route.ts` (spec 028) already uses, so the two upload paths cannot drift apart.
