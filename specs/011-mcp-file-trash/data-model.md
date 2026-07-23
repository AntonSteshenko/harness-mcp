# Data Model: MCP File Trash

**Input**: [spec.md](./spec.md) Key Entities, [research.md](./research.md)

This feature adds no new storage backend or schema — `Trash` and `Trashed Item` are not new kinds of object, just a reserved region of the existing File/Directory model from spec 002's data-model.md. Both entities below are addressed by the same filesystem-style path scheme already used everywhere in this project.

## Trash

The reserved top-level Directory (spec 002 sense) that holds soft-deleted content.

| Field | Type | Notes |
|---|---|---|
| `path` | string (constant) | Always `Trash/`. Reserved — see spec Assumptions. |
| entries | list of per-deletion subfolders | Each entry is one soft-delete operation's `opId` subfolder (see Trashed Item below); computed on read via the existing `listDirectory("Trash")`, not stored separately. |

**Validation rules**: None beyond the existing Directory rules (spec 002 data-model.md) — `Trash` is created implicitly the first time anything is soft-deleted into it (research.md §5), and is otherwise an ordinary Directory: listable, and (per FR-006) fully permanently-deletable in one `delete_directory("Trash")` call, which empties it.

**Lifecycle**: Comes into existence implicitly on the first soft-delete → accumulates one subfolder per subsequent soft-delete → individual subfolders (or the whole of `Trash`) are permanently removed by calling `delete_directory`/`delete_file` again on a path already under `Trash` (FR-005/FR-006).

## Trashed Item

A File or Directory (spec 002 sense) currently located under `Trash`, identified by the deletion operation that put it there plus its original relative path (Clarifications 2026-07-23).

| Field | Type | Notes |
|---|---|---|
| `opId` | string | `<UTC timestamp, colon-free>-<6 hex chars>` (research.md §2), e.g. `20260723T140522123Z-a1b2c3`. Generated once per delete call; shared by every file moved as part of that single `delete_file`/`delete_directory` call. |
| `originalPath` | string | The item's filesystem-style path immediately before this deletion (relative, e.g. `notes/todo.txt`); preserved verbatim beneath the `opId` subfolder. |
| `trashedPath` | string | Computed as `Trash/<opId>/<originalPath>`; this is the item's actual current path in storage while trashed, and what `list_directory("Trash")` (recursively, one level at a time) surfaces. |
| everything else (`content`/`size`/`lastModified` for a File; `entries` for a Directory) | — | Unchanged from spec 002's File/Directory model — a Trashed Item is not a distinct storage kind, just an ordinary File or Directory whose path happens to start with `Trash/`. |

**Validation rules**: `trashedPath` must not already exist when a soft-delete computes it — guaranteed in practice by `opId`'s randomness (research.md §2); if it somehow did collide, the underlying `move()` call's existing `already_exists` guard (spec 002) surfaces that as an error rather than overwriting anything (no silent data loss, per FR-007's intent).

**Lifecycle**: created by a soft-delete (`delete_file`/`delete_directory` on a path outside `Trash`, via an internal `move()`, FR-001–FR-004) → optionally restored (moved back out via the existing `move` MCP tool to any destination, FR-009 — the item stops being a Trashed Item the moment it's moved out from under `Trash/`) → optionally permanently removed (`delete_file`/`delete_directory` called again on its `trashedPath`, FR-005/FR-006 — it stops existing entirely).

## Relationships

- `Trash` is an ordinary Directory (spec 002) whose direct children (via `listDirectory("Trash")`) are `opId` subfolders, each itself a Directory whose contents mirror one deletion operation's moved items under their `originalPath` structure.
- A Trashed Item's identity (`opId` + `originalPath`) only exists implicitly, as the two path segments after the `Trash/` prefix — there is no separate index; `trashedPath` is the sole source of truth.
- Deleting `Trash` itself (`delete_directory("Trash")`) cascades to every `opId` subfolder and everything beneath them, permanently — the same cascade behavior spec 002 already defines for any Directory delete, applied to the special case where the Directory being permanently deleted is `Trash` itself (FR-006).
