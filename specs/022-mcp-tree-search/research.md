# Research: MCP Tree Search Tools

**Input**: [spec.md](spec.md)

All unknowns below were resolved by reading the existing storage layer (`frontend/lib/storage/`) and MCP tool layer (`frontend/lib/mcp-tools/`) rather than by asking the user — this feature is additive within an established pattern, not a new subsystem.

## 1. How to traverse the whole subtree without one-level-at-a-time calls

**Decision**: Generalize the existing BFS traversal already used internally — `listFilesRecursive` (`frontend/lib/storage/directories.ts:141-162`) — into a new shared helper, `walkTree`, that yields **every** descendant (files *and* directories, not just `.md` files) and stops at a fixed entry cap.

**Rationale**: Recursive traversal over this S3-backed tree already exists in three places (`directories.ts:141-162`, the paginated key-collection loop inside `deleteDirectory` at `directories.ts:92-106`, and `move.ts`'s private `listAllKeys`). `listFilesRecursive` is the closest match to what User Story 1 needs — it already composes the existing `listDirectory(path)` (`directories.ts:38-71`) via a `pending: string[]` queue, which already gets `not_found`/`type_mismatch` on the root path for free (through `listDirectory`'s own checks) and already returns entries in the exact `{path, size, lastModified}` shape the rest of the codebase uses. Generalizing this one function (drop the `.md`-only filter, add directories to the result, add a cap and Trash exclusion) is less code and more consistent than writing a new traversal from scratch.

**Alternatives considered**:
- *Building the tree client-side, reusing the web file explorer's tree logic*: rejected — `frontend/app/files/FileTree.tsx:280-303` fetches one level at a time lazily via SWR as the user expands nodes; it has no server-side "give me the whole subtree" function to extract, so there's nothing to reuse there.
- *Using S3 `ListObjectsV2` without a `Delimiter` directly in each new tool*: rejected — this bypasses `listDirectory`'s existing not_found/type_mismatch/OAuth-prefix-exclusion checks and would duplicate that logic three times (once per new tool) instead of once in a shared helper.

## 2. Where to put the Trash exclusion

**Decision**: Reuse the existing, already-exported `isUnderTrash(path): boolean` (`frontend/lib/storage/trash.ts:11-14`) inside `walkTree`, skipping any directory before it's queued and any file before it's collected.

**Rationale**: `isUnderTrash` is already the single source of truth for "is this the reserved Trash folder" (a case-sensitive, full-segment prefix check against `Trash/`), currently used by `deleteDirectory`/`deleteFile` to decide soft- vs. permanent-delete. No new constant or check needs to be invented; today it's simply never applied to listing, which is exactly the gap spec 022 FR-011 closes.

**Alternatives considered**: A separate `TRASH_DIR_NAME` constant duplicated in the new module — rejected, `trash.ts` already owns this and exports what's needed.

## 3. Response capping and truncation

**Decision**: A single module-level constant (`MAX_TREE_ENTRIES`, proposed value 500) in the new `frontend/lib/storage/tree.ts`, applied uniformly: `walkTree` stops enqueuing/collecting once the cap is hit and returns `truncated: true`; the content-search tool applies the same cap to how many Markdown files it will read and scan.

**Rationale**: Spec 022's Assumptions section explicitly defers the exact number to planning ("a few hundred entries... the exact number is a planning/implementation detail, not a product decision") and states the storage tree in real use is "hundreds, not millions, of entries." 500 comfortably covers realistic Company OS trees (the local dev bucket sampled during this planning has well under 100 entries total) while bounding worst-case latency/response size.

**Alternatives considered**: Pagination (continuation tokens) across calls — rejected as unnecessary complexity for the stated scale (SC-004: "feel like a single interactive step... not a multi-step investigation" — pagination would reintroduce the multi-round-trip problem this feature exists to remove).

## 4. Name matching semantics

**Decision**: Case-insensitive substring match against each entry's **final path segment** (the file or directory's own name), not the full path.

**Rationale**: User Story 2's examples ("the invoicing skill", "the todo file") name the thing itself, not a parent folder. Matching the full path would make every file under a matching folder name a "match" for that folder's name, which is surprising and noisy (e.g. searching "skills" would match every file under `os/skills/`, not just things named "skills").

**Alternatives considered**: Full-path substring match — rejected for the noise reason above; can be revisited later as an opt-in mode if it turns out to be wanted.

## 5. Content search scope and validation

**Decision**: Content search only opens files whose name ends in `.md` (case-insensitive, same rule `listFilesRecursive` already uses), reads them with the existing `readFile` (`frontend/lib/storage/files.ts`), and does a case-insensitive substring search over the content; a file that fails to read/decode is skipped rather than failing the whole search (FR-007), wrapped in its own try/catch. Both search tools reject an empty/whitespace-only query via a Zod schema constraint (`z.string().trim().min(1)`) at the tool boundary — the same layer that already validates `path`/`content` for every existing tool (`frontend/lib/mcp-tools/index.ts`) — rather than inventing a new `StorageErrorCode`.

**Rationale**: The four existing error codes (`frontend/lib/storage/errors.ts:1-5`: `not_found`, `type_mismatch`, `already_exists`, `storage_unreachable`) have no "invalid input" case today because every existing tool's inputs are unconstrained strings (a path is a path). Adding a fifth storage-layer error code for one validation rule would be a wider change than needed; MCP's SDK already surfaces a Zod validation failure as a tool input error to the calling client without any new code in `errors.ts`/`result.ts`.

**Alternatives considered**: A new `invalid_input` `StorageErrorCode` — rejected as broader surface area than the one validation rule requires; Zod-level rejection is the existing, un-widened mechanism.

## 6. Where the new tools live

**Decision**: A new module `frontend/lib/mcp-tools/treeTools.ts` exporting `registerTreeTools(server)`, following the exact pattern of `engineTools.ts`/`messagingTools.ts`/`inboxTools.ts`, registered alongside them in `frontend/app/mcp/route.ts`.

**Rationale**: This repo already splits MCP tools into one file per feature area, each with its own `register*Tools(server)` export, composed in `route.ts`'s `createMcpHandler` callback (`route.ts:18-24`). This feature is a new, independent capability area (tree search), not an addition to the core CRUD tools in `index.ts` — matching the existing modularity keeps `index.ts` (and its documented 8-tool contract, spec 002) untouched, satisfying spec 022 FR-013/SC-005.

## 7. Testing approach

**Decision**: No new automated test framework is introduced. Verification follows the same convention every prior spec in this repo uses: a runnable `quickstart.md` (manual MCP tool calls with expected outputs) plus the contract doc as the source of truth for shape/error behavior.

**Rationale**: Confirmed there is no test runner in this repo at all — `frontend/package.json` only has `dev`/`build`/`start`/`lint` scripts, and there are zero `*.test.*`/`*.spec.*` files anywhere in the tree. Specs 002 and 011 (the two most similar prior features — the original file/directory tools and the Trash soft-delete behavior) both substitute a `contracts/*.md` + `quickstart.md` pair for automated tests. Introducing a test framework here would be a much larger, unrelated change and contradicts established project convention.

**Alternatives considered**: Introducing Vitest/Jest for this feature only — rejected as scope creep and inconsistent with every other feature in the repo.
