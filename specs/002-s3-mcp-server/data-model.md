# Data Model: S3 Storage MCP Server

**Input**: [spec.md](./spec.md) Key Entities, [research.md](./research.md)

This feature has no application database of its own — entities below map directly onto S3 objects in the spec 001 MinIO storage, accessed through the storage-adapter layer described in research.md §2–§5.

## File

Represents stored content addressable by a filesystem-style path (FR-002–FR-005, FR-009, FR-016).

| Field | Type | Notes |
|---|---|---|
| `path` | string | Filesystem-style path (e.g. `notes/todo.txt`); maps 1:1 to an S3 object key with the same value. Must not end in `/` (that denotes a directory — see below). |
| `content` | binary/string | Opaque to the server (FR-016's "no format interpretation"); read/written as a whole (no streaming, no chunking, no size ceiling beyond storage/memory limits). |
| `size` | integer (bytes) | Reported by the storage engine (S3 `ContentLength`). |
| `lastModified` | timestamp | Reported by the storage engine (S3 `LastModified`). |

**Validation rules**: A create/write MUST be rejected with a clear error (FR-012) if an entry already exists at the same path as a Directory (i.e., a directory marker or any object sharing that prefix). Path segments follow standard S3 key-naming constraints inherited from spec 001's Bucket/Object validation (research.md §2 in spec 001's data-model.md).

**Lifecycle**: created (`PutObject`) → optionally modified via whole-file overwrite (`PutObject` again, FR-004) → optionally moved (copy-to-new-key + delete-old-key, research.md §5) → deleted (`DeleteObject`). No versioning (spec Assumptions).

## Directory

Represents a hierarchical grouping of Files and child Directories at a path (FR-006–FR-008, FR-010).

| Field | Type | Notes |
|---|---|---|
| `path` | string | Filesystem-style path, always treated as ending in `/` internally (e.g. `notes/`). |
| `entries` | list of (File \| Directory) | Computed on read via `ListObjectsV2` with `Delimiter: "/"` and `Prefix: path` (research.md §3) — not stored as a field, derived per listing call. |

**Validation rules**: A create MUST be rejected with a clear error (FR-012) if a File already exists at the same path. An explicitly created Directory is persisted as a zero-byte marker object at key `<path>/` so it remains listable even with zero entries (FR-007) — this marker is an implementation detail, never surfaced to the MCP client as a "file."

**Lifecycle**: created (`PutObject` of the empty marker, research.md §3) → populated implicitly as Files/Directories are created under its prefix → optionally moved (recursive copy-then-delete of everything under its prefix, research.md §5) → deleted, which recursively removes the marker and everything under its prefix in one operation (`ListObjectsV2` + batched `DeleteObjects`, research.md §4), leaving zero orphaned Files (FR-008, SC-003).

## Relationships

- A Directory's `entries` are the Files and Directories whose path is exactly one segment deeper than the Directory's own path (i.e., direct children only — `ListObjectsV2`'s `Delimiter: "/"` behavior, not a recursive listing).
- Deleting or moving a Directory cascades to every File and Directory nested under it, at any depth (FR-008, FR-010).
- Every File and Directory ultimately resolves to one or more S3 object keys within the single, pre-configured storage location established by spec 001 (FR-013) — there is no cross-bucket relationship in scope.
