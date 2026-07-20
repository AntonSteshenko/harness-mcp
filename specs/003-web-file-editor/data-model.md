# Data Model: Web File Explorer & Markdown Editor

**Input**: [spec.md](./spec.md) Key Entities, [research.md](./research.md)

This feature introduces no new persisted storage entities — it's a browsing/editing surface over the File and Directory concepts already defined in spec 002's data model, plus one purely client-side, never-persisted concept.

## File / Directory (reused, not redefined)

Same as spec 002-s3-mcp-server's `data-model.md`: a File is content addressable by a path; a Directory is a hierarchical grouping of Files/Directories at a path. This feature reads and updates them exclusively through the existing `lib/storage/files.ts` / `lib/storage/directories.ts` functions (research.md §2–§3) — it adds no fields, no new validation rules, and no new lifecycle states to either.

## Editor Session (new, client-side only)

Represents the state of whichever file is currently open in the browser. Exists only in the browser's memory; never persisted to storage or any server-side session store.

| Field | Type | Notes |
|---|---|---|
| `path` | string \| null | The currently open file's path, or `null` if nothing is open. |
| `loadedContent` | string | The content as last fetched from `GET /api/file` (or last successfully saved). |
| `currentContent` | string | The content as currently shown in the editor, including any in-progress edits. |
| `kind` | `"markdown"` \| `"text"` \| `"unsupported"` | Derived from the file's extension/decoded content (research.md §6) — determines which editing view is shown. |
| `dirty` | boolean (derived) | `currentContent !== loadedContent`. Drives the unsaved-changes indicator (FR-008) and navigation/unload warnings (FR-009, research.md §7). |
| `saveState` | `"idle"` \| `"saving"` \| `"error"` | Drives the save-in-progress/success/error UI (FR-008, FR-010). |

**Validation rules**: none beyond what `readFile`/`updateFile` already enforce server-side (spec 002 FR-003/FR-004, FR-011). The UI does not duplicate path-validity or naming rules — it only ever operates on paths obtained from the tree (`GET /api/tree`) or an already-open file, which are by construction paths the storage layer has already confirmed exist.

**Lifecycle**: created when a file is opened (tree selection → `GET /api/file`) → mutated as the user types (`currentContent` changes) → either saved (`PUT /api/file` succeeds → `loadedContent` reset to match `currentContent`, `dirty` becomes false) or discarded (user opens a different file / navigates away and confirms) → replaced or cleared when a different file is opened or none is open.
