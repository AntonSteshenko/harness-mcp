# Data Model: File Delete & Create

**Input**: [spec.md](./spec.md) Key Entities, [research.md](./research.md)

This feature introduces no new persisted storage entities and no new fields on existing ones. It adds three transient, client-triggered actions that call already-existing spec 002 storage primitives (`createFile`, `deleteFile`, `createDirectory`) — nothing here is retained beyond the resulting file/directory state in storage.

## File / Directory (reused, not redefined)

Same as spec 002/003/004: a File is content-addressable by path; a Directory is a hierarchical grouping of Files/Directories at a path. This feature adds no fields, no new validation rules, and no new lifecycle states to either — it only calls storage functions that already exist and are already used elsewhere (`lib/mcp-tools/`).

## Delete Action (new, client-side only, transient)

Represents one "Delete" click on a file row through to the server's response.

| Field | Type | Notes |
|---|---|---|
| `path` | string | The file's full path, as already shown in the tree row that triggered the action. |
| `confirmed` | boolean | Set by the `window.confirm` dialog (FR-002); if `false`, no request is sent and nothing changes. |
| `outcome` | `"deleted" \| "failed"` | Filled in from `DELETE /api/file`'s response; drives whether the tree/editor is updated or an error is shown. |

**Validation rules**: No new path-validity rules — `path` is always one already returned by `GET /api/tree`, never user-typed. `deleteFile` (existing, `lib/storage/files.ts`) already rejects with `not_found` if the file no longer exists and `type_mismatch` if `path` now points at a directory (e.g., raced by another action); both are surfaced as the "clear error" required by FR-009/Edge Cases.

**Lifecycle**: triggered by the user → confirmed (or abandoned) → `DELETE /api/file?path=...` → on success, the parent directory's listing is refreshed and, if `path` matched the currently open file, the editor is closed (FR-003, research.md §3) → action discarded (nothing about it is retained after the tree reflects the new state).

## Create-File Action (new, client-side only, transient)

Represents one "New file" click on a directory row through to the file opening in the editor.

| Field | Type | Notes |
|---|---|---|
| `parentPath` | string | The directory row the action was triggered from. |
| `name` | string | Free-form text entered via `window.prompt` (FR-004); rejected before any request if it contains `/` or is blank/whitespace-only (FR-007). |
| `targetPath` | string | `parentPath` + `name`, joined the same way every other path in this app is normalized (`lib/storage/paths.ts`). |
| `overwriteConfirmed` | boolean \| undefined | Only relevant if `targetPath` already names an existing file in the parent directory's currently-known listing; set by a `window.confirm` (FR-006). Undefined (no prompt shown) when there's no name collision. |
| `outcome` | `"created" \| "failed"` | Filled in from `POST /api/file`'s response. |

**Validation rules**: `name` must not contain `/` (FR-007) — checked client-side before any request. A blank/whitespace-only `name` (including a cancelled `window.prompt`, which returns `null`) is treated as "nothing to create," matching the cancel behavior already used for cancelled upload/download confirmations in spec 004. Server-side, `createFile` (existing, unchanged) overwrites in place if a file already exists at `targetPath`, and rejects with `already_exists` only if a *directory* occupies that exact path — both are pre-empted or surfaced per FR-006/FR-009.

**Lifecycle**: triggered by the user → name entered and validated → (if name collision) confirmed → `POST /api/file` with empty content → on success, the parent directory's listing is refreshed and the new file opens in the editor (FR-010) → action discarded.

## Create-Folder Action (new, client-side only, transient)

Represents one "New folder" click on a directory row through to the new subfolder appearing in the tree.

| Field | Type | Notes |
|---|---|---|
| `parentPath` | string | The directory row the action was triggered from. |
| `name` | string | Free-form text entered via `window.prompt` (FR-005); rejected before any request if it contains `/` or is blank/whitespace-only (FR-007). |
| `targetPath` | string | `parentPath` + `name`, normalized the same way as any directory path. |
| `outcome` | `"created" \| "failed"` | Filled in from `POST /api/directory`'s response. |

**Validation rules**: Same `name` rules as Create-File. Server-side, `createDirectory` (existing, unchanged) is idempotent — creating a directory that already exists at `targetPath` succeeds with no error (Assumptions) — and rejects with `already_exists` only if a *file* occupies that exact path, which is surfaced as the clear error required by Acceptance Scenario 3 (User Story 3).

**Lifecycle**: triggered by the user → name entered and validated → `POST /api/directory` → on success, the parent directory's listing is refreshed so the new (or already-existing) subfolder appears → action discarded.
