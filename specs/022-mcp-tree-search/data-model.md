# Data Model: MCP Tree Search Tools

**Input**: [spec.md](spec.md), [research.md](research.md)

This feature introduces no persisted entities — it only reads the existing S3-backed file/directory structure (spec 001/002) and shapes what's already there into new response types. The "entities" below are in-memory shapes returned by the new tools.

## TreeEntry

One file or directory discovered while walking a subtree (User Story 1, and the basis for name search in User Story 2).

| Field | Type | Notes |
|---|---|---|
| `path` | `string` | Full path from the storage root, same format every existing tool uses (e.g. `"os/skills/lead.md"`). |
| `kind` | `"file" \| "directory"` | Distinguishes the two, per FR-002. |
| `size` | `number \| undefined` | Only present when `kind` is `"file"` — bytes, same as `listDirectory`'s existing file entries. |
| `lastModified` | `string \| undefined` | Only present when `kind` is `"file"` — ISO 8601, same as `listDirectory`'s existing file entries. |

Produced by the shared `walkTree` helper (research.md §1); Trash entries (per `isUnderTrash`, research.md §2) are never included.

## WalkResult

The internal (and, shaped slightly differently per tool, external) result of one traversal.

| Field | Type | Notes |
|---|---|---|
| `entries` | `TreeEntry[]` | Every collected entry, capped at `MAX_TREE_ENTRIES` (research.md §3). |
| `truncated` | `boolean` | `true` if the cap was hit before the whole subtree was explored (FR-012). |

## NameMatch

One result row for the "find by name" tool (User Story 2). A `TreeEntry` (path + kind) — no extra fields; the match is the entry itself. Reusing `TreeEntry` here directly (rather than a separate type) keeps the two tools' output shapes consistent for a calling client.

## ContentMatch

One result row for the "find by content" tool (User Story 3).

| Field | Type | Notes |
|---|---|---|
| `path` | `string` | The matching Markdown file's full path. |
| `snippet` | `string` | A short excerpt of the file's content around the first match, so the caller can judge relevance without a separate `read_file` call (per the Key Entities section of spec.md). |

## Relationships / flow

```
list_directory_tree(path)
  └─ walkTree(path) → { entries: TreeEntry[], truncated }

find_files_by_name(query, path?)
  └─ walkTree(path ?? "") → entries
       └─ filter: entries whose final path segment matches `query` (case-insensitive substring, research.md §4)
       → { matches: NameMatch[], truncated }

search_file_content(query, path?)
  └─ walkTree(path ?? "") → entries
       └─ filter: entries where kind === "file" and path ends in ".md" (case-insensitive)
       └─ for each (up to MAX_TREE_ENTRIES scanned): readFile(path), skip on read/decode failure (FR-007)
       └─ filter: content contains `query` (case-insensitive substring)
       → { matches: ContentMatch[], truncated }
```

All three reuse `walkTree`'s `not_found`/`type_mismatch` propagation (inherited from `listDirectory`, research.md §1) for an invalid starting `path`, and `storage_unreachable` propagation (inherited from `wrapStorageError`, already applied inside `listDirectory`/`readFile`) for connectivity failures — no new error types are introduced (research.md §5).
