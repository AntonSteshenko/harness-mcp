# Phase 0 Research: File Delete & Create

## §1. API route shape for create/delete

**Decision**: Extend `app/api/file/route.ts` with `POST` (create file) and `DELETE` (delete file, `path` query param, mirroring the existing `GET`'s query-param convention) handlers. Add a new sibling `app/api/directory/route.ts` with a single `POST` (create directory) handler.

**Rationale**: `app/api/file/route.ts` already owns `GET`/`PUT` for the file resource — `POST`/`DELETE` are the natural remaining REST verbs on the same resource and route, avoiding a new file for a two-handler addition. Directory creation is a distinct resource (no directory route exists yet, unlike `file`), so it gets its own route file, matching how `app/api/tree/route.ts` already exists as the directory *read* counterpart. Both new handlers are thin wrappers that call `createFile`/`deleteFile`/`createDirectory` from `lib/storage/*`, exactly like every other route in specs 003/004 (FR-011) — they add no business logic beyond mapping `StorageError.code` to an HTTP status, copying the `STATUS_BY_CODE` map already used in `file/route.ts`, `tree/route.ts`, `upload/route.ts`, and `download-zip/route.ts`.

**Alternatives considered**:
- A single generic `/api/entry` route for both files and directories — rejected because it would blur the file/directory distinction the storage layer and existing routes already keep separate (`files.ts` vs `directories.ts`), and existing conventions (`file/route.ts`, `tree/route.ts`) already split by resource type.
- Body-based `path` for `DELETE` instead of a query param — rejected for consistency with the existing `GET /api/file?path=...` convention on the same route file.

## §2. UI interaction pattern for delete/create actions

**Decision**: Reuse the exact interaction pattern spec 004 established in `FileTree.tsx`: a small inline icon button (`iconButtonStyle`) per row, using `window.confirm` for the delete confirmation and `window.prompt` for entering a new file/folder name, followed by a `refreshEntries()` call on success. Icons follow the existing inline-SVG convention in `Icons.tsx` (no emoji, per its existing top-of-file comment).

**Rationale**: `FileTree.tsx` already has three working precedents for exactly this shape of interaction — `handleUpload`'s `window.confirm` overwrite check, `handleUpload`'s `window.alert` result summary, and `handleDownloadFolder`'s busy-state handling. Introducing a modal component or a form-based create dialog would be a new UI pattern for a one-field input, when `window.prompt` already covers the "enter a name" case with zero new code paths, consistent with how the codebase favors minimal, native-browser UI primitives over custom dialog components elsewhere in the editor.

**Alternatives considered**:
- A custom modal/dialog component for naming new files/folders — rejected as disproportionate to a single free-text input, and inconsistent with the `window.prompt`/`window.confirm`/`window.alert` pattern already used throughout `FileTree.tsx`.
- Inline rename-style text input appearing in the tree (like VS Code) — rejected as a bigger interaction-design change than this feature's scope calls for; `window.prompt` satisfies every acceptance scenario in spec.md without new state machinery.

## §3. Closing the editor when its open file is deleted

**Decision**: Add an optional `onFileDeleted?: (path: string) => void` prop to `FileTreeProps`, threaded down through `DirectoryNode` (same way `onSelectFile` already is), fired after a successful delete. `app/editor/page.tsx` passes a handler that clears `selectedPath` when the deleted path matches the currently open one.

**Rationale**: `page.tsx` already owns `selectedPath` as the single source of truth for what's open (`FileEditor path={selectedPath}`), and `FileTree` already receives one callback prop (`onSelectFile`) from `page.tsx` in the same direction. Adding a second, symmetric callback is the smallest change that satisfies FR-003 without giving `FileTree` any knowledge of editor/dirty state, and without giving `FileEditor` any knowledge of the tree.

**Alternatives considered**:
- Having `FileEditor` itself detect a 404 on next interaction — rejected because it would leave a deleted file's stale content visibly open and editable until the user does something else, failing FR-003's "closes that editor view once deletion succeeds" requirement.
- Lifting `selectedPath` state into `FileTree` instead of `page.tsx` — rejected as a larger refactor than this feature needs; `page.tsx` already owns this state and only needs one more callback.
