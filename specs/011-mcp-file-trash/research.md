# Research: MCP File Trash

**Input**: [spec.md](./spec.md) — Clarifications session 2026-07-23 (per-deletion timestamped subfolder)

All unknowns from the Technical Context have been resolved below; no `NEEDS CLARIFICATION` markers remain.

## 1. Where the soft-delete logic lives

**Decision**: Add a new `frontend/lib/storage/trash.ts` module exporting two pure helpers — `isUnderTrash(path): boolean` and `trashDestinationFor(path): string` — and call them from `deleteFile` (`files.ts`) and `deleteDirectory` (`directories.ts`), which branch on `isUnderTrash`: if `true`, run the existing permanent-delete code path unchanged; if `false`, call the existing `move()` (from `move.ts`) to relocate the target into the computed Trash destination instead of deleting it.

**Rationale**: `move()` (research.md §5 of spec 002) already implements the exact "copy everything first, then delete the source" semantics needed for a safe soft-delete of either a file or a directory, and already rejects with `already_exists` if the destination is occupied — reusing it means no new S3 orchestration code is needed, only a new destination-path calculation and a branch. Because `deleteFile`/`deleteDirectory` are the single choke point also used by the web editor's API routes (`app/api/file/route.ts`, `app/api/directory/route.ts`), putting the branch there — rather than in the MCP tool handlers — makes the new behavior apply uniformly everywhere delete already happens, with zero API-route or UI changes (FR-010).

**Alternatives considered**:
- Branching inside `frontend/lib/mcp-tools/index.ts` only — would leave the web editor's delete button permanently destructive, contradicting the "applies uniformly, no UI changes required" framing established when this issue was scoped to the MCP layer (the MCP layer's own storage functions are also what the web editor already calls).
- A dedicated `trashFile`/`trashDirectory` pair of functions called instead of `deleteFile`/`deleteDirectory` from the MCP tool layer, leaving `deleteFile`/`deleteDirectory` themselves always-permanent — rejected because it would require the web editor's routes to also switch call targets to get the same safety net, doubling the change surface for no benefit over branching once inside the existing functions.

## 2. Trashed-path construction

**Decision**: `trashDestinationFor(path)` returns `Trash/<opId>/<original-relative-path>`, where `<opId>` is generated once per delete call as `<UTC timestamp, filesystem-safe format>-<6 hex chars of randomness>`, e.g. `Trash/20260723T140522123Z-a1b2c3/notes/todo.txt`. The timestamp component uses a colon-free, sortable format (`YYYYMMDDTHHMMSSmmmZ`) so trashed batches list in chronological order; the random suffix guarantees uniqueness even when two deletes land in the same millisecond.

**Rationale**: The Clarifications session decided on "timestamped subfolder per deletion." A plain millisecond timestamp alone is not collision-proof under concurrent or scripted rapid-fire deletes, and FR-007 requires two delete operations to never collide on the same subfolder — the random suffix closes that gap cheaply (`crypto.randomBytes(3).toString("hex")`, already available via Node's built-in `crypto` module, no new dependency). Filesystem-style paths (spec 002 FR-014) exclude colons from the timestamp representation so the resulting path is unambiguous as a plain path string, matching how every other path in this system looks.

**Alternatives considered**:
- Timestamp only, no random suffix — rejected: two `delete_file` calls issued back-to-back (e.g., by a scripted agent) can land in the same millisecond, which would make `move()`'s `already_exists` check fail the second delete instead of trashing it.
- A monotonically increasing in-memory counter instead of randomness — rejected: counters don't survive a server restart or work across serverless instances, and would not actually guarantee uniqueness across concurrent requests without additional locking; a random suffix needs no shared state.
- One directory per calendar day (`Trash/2026-07-23/...`) with per-file collision suffixes — considered closer to "coarse" trash-bin conventions, but re-introduces per-item collision handling (rejected by the Clarifications answer) instead of resolving uniqueness once per operation.

## 3. Detecting "already in Trash"

**Decision**: `isUnderTrash(path)` normalizes `path` the same way `normalizeDirectoryPath` does elsewhere in `lib/storage/`, then returns true if the normalized value is exactly `"Trash/"` or starts with `"Trash/"`. This is a case-sensitive, full-path-segment prefix check (so `TrashCan/notes.md` is correctly treated as outside Trash).

**Rationale**: The system has no metadata store; "is this already trashed" must be derivable purely from the path string, and every existing storage function already normalizes paths the same way (`paths.ts`), so reusing that normalization keeps the check consistent with how every other path comparison in this codebase already works.

**Alternatives considered**:
- A tag/metadata object attached to trashed items (e.g. S3 object metadata or a sidecar JSON) — unnecessary complexity; the reserved top-level folder name is already sufficient and matches the spec's Assumptions ("`Trash` is a reserved top-level folder name").

## 4. Output shape for `delete_file`/`delete_directory`

**Decision**: Extend (additively, no breaking removals) the existing result shapes:
- `delete_file`: `{ path: string, deleted: true, permanent: boolean, trashedTo?: string }`
- `delete_directory`: `{ path: string, deleted: true, permanent: boolean, filesRemoved: number, trashedTo?: string }`

`permanent: false` and `trashedTo` (the new Trash path) are set on a soft-delete; `permanent: true` (and no `trashedTo`) on a permanent delete (i.e., the target was already under `Trash`). `filesRemoved` continues to count the number of file objects affected, whether moved (soft-delete) or destroyed (permanent delete).

**Rationale**: `deleted: true` remains true in both cases (something did happen to the target at that path — it's gone from where it was), preserving backward compatibility for any caller only checking that field (spec 002/005 behavior). The new fields let a caller/agent immediately know where an item landed without a separate `list_directory` round trip, directly enabling User Story 4's "inspect and recover" flow.

**Alternatives considered**:
- Returning a completely different shape per case (discriminated union with no shared `deleted` field) — rejected: breaks the existing contract's `deleted: true` guarantee for zero benefit, since additive fields already convey the extra information.
- Omitting `trashedTo` and requiring the caller to recompute/guess the Trash destination — rejected: recomputing would require the caller to know the exact timestamp+random `opId`, which is only known server-side at the moment of the move; returning it is strictly cheaper than a follow-up `list_directory` call.

## 5. Auto-creating `Trash`

**Decision**: No explicit "create Trash" step is needed. `move()`'s underlying `CopyObjectCommand`/`PutObjectCommand` calls create any needed key directly; S3-compatible storage has no real "folder" to pre-create (research.md §3 of spec 002 — directories are just key prefixes). The first soft-delete implicitly brings `Trash/...` into existence exactly the way any other nested path already does today.

**Rationale**: Matches the existing directory-emulation model (spec 002 research.md §3) exactly — nothing new to build.

**Alternatives considered**:
- Explicitly calling `createDirectory("Trash")` at startup or on first use — unnecessary; would only create an empty marker object that provides no behavior not already implied by the first trashed item landing under that prefix.

## 6. Validation approach

**Decision**: Same as spec 002/005 — validate via a scripted MCP tool-call sequence in `quickstart.md` against a running `next dev` instance plus the spec 001 MinIO stack. No automated test suite is added.

**Rationale**: Consistent with every prior spec in this project; this project's tooling instructions also direct against running tests as part of routine work.
