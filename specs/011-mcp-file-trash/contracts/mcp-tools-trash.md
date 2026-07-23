# Contract: `delete_file` / `delete_directory` Trash Behavior

**Input**: [spec.md](../spec.md), [data-model.md](../data-model.md), [research.md](../research.md)

**Supersedes (additively)**: `delete_file` and `delete_directory` entries in [specs/002-s3-mcp-server/contracts/mcp-tools.md](../../002-s3-mcp-server/contracts/mcp-tools.md). No tool is renamed, added, or removed — `create_file`, `read_file`, `update_file`, `create_directory`, `list_directory`, and `move` are all unchanged by this feature and keep their spec 002 contracts exactly as documented there.

## `delete_file`

Deletes the file at `path`. If `path` is **not** already under the reserved `Trash` folder, the file is **moved** into a new per-deletion subfolder under `Trash` instead of being destroyed (soft-delete). If `path` **is** already under `Trash`, the file is destroyed for real (permanent delete) — this is how a caller empties an item out of `Trash` for good.

- **Input**: `{ path: string }` — unchanged from spec 002.
- **Output**: `{ path: string, deleted: true, permanent: boolean, trashedTo?: string }`
  - `permanent: false, trashedTo: "Trash/<opId>/<original-relative-path>"` — soft-delete case.
  - `permanent: true` (no `trashedTo`) — permanent-delete case (target was already under `Trash`).
- **Errors**: `not_found` if nothing exists at `path`; `type_mismatch` if `path` is a directory (use `delete_directory`); `storage_unreachable` on connectivity failure (unchanged from spec 002).
- **Satisfies**: spec 011 FR-001, FR-003, FR-004, FR-005, FR-007.

## `delete_directory`

Deletes the directory at `path` and everything inside it, recursively. Same soft-delete/permanent-delete branch as `delete_file`, applied to the whole subtree in one call. Calling this on `Trash` itself permanently empties the entire Trash in one call (no dedicated "empty trash" tool).

- **Input**: `{ path: string }` — unchanged from spec 002.
- **Output**: `{ path: string, deleted: true, permanent: boolean, filesRemoved: number, trashedTo?: string }`
  - `permanent: false, trashedTo: "Trash/<opId>/<original-relative-path>"`, `filesRemoved` = number of files moved into Trash — soft-delete case.
  - `permanent: true` (no `trashedTo`), `filesRemoved` = number of files permanently destroyed — permanent-delete case, including the "empty Trash" special case (`path` = `"Trash"`).
- **Errors**: `not_found` if nothing exists at `path`; `type_mismatch` if `path` is a file (use `delete_file`); `storage_unreachable` on connectivity failure (unchanged from spec 002).
- **Satisfies**: spec 011 FR-002, FR-003, FR-004, FR-006, FR-007.

## No new tools

Per spec 011's Assumptions, this feature deliberately reuses two already-existing tools for the rest of the Trash workflow — no `restore` or `empty_trash` tool is added:

- **Inspecting Trash** (spec 011 FR-008, US4): use the existing `list_directory` tool on `"Trash"`, then descend into whichever `opId` subfolder is of interest — same tool, same contract as spec 002.
- **Restoring a trashed item** (spec 011 FR-009, US4): use the existing `move` tool with `sourcePath` set to the item's `trashedTo` value (returned by the soft-delete call, or discovered via `list_directory`) and `destinationPath` set to wherever it should go — same tool, same contract as spec 002, including its `already_exists` guard against silently overwriting something already at the destination.
- **Emptying Trash entirely** (spec 011 FR-006): call `delete_directory("Trash")` — covered by this contract's permanent-delete branch above.

## Cross-cutting

- The `Trash` prefix check (`path` or any ancestor segment equal to `Trash`) is case-sensitive and matches on the full first path segment only — `TrashCan/notes.md` is treated as a normal path outside `Trash`, not as trashed content (research.md §3).
- No new error codes are introduced; the existing `not_found` / `type_mismatch` / `already_exists` / `storage_unreachable` set (spec 002) covers every failure mode in this feature, including the vanishingly rare `trashedTo` collision (research.md §2, §4).
- As with every other tool, this feature adds no locking/versioning — the spec 002 single-active-client concurrency assumption is unchanged.
