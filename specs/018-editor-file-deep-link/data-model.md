# Phase 1 Data Model: Editor File Deep Linking via URL

This feature introduces **no new persisted entities** and **no new storage fields**. It changes where one existing value — the open file's `path` — lives (from in-memory React state to the page URL) and adds no new domain data.

## Reused Entity (unchanged)

### File Path (specs 001/002/003)

| Field | Type | Notes |
|---|---|---|
| `path` | string | Identifies a file 1:1 with its S3 object key (e.g. `notes/todo.md`); already the sole identifier used by `/api/file`, `/api/tree`, `/api/directory`, `/api/download-zip` |

**Relevant behavior for this feature**: the same `path` string is now also the value carried directly in the `/files/<path>` URL's own path segments (FR-012) — not a query parameter. No new validation rules are introduced — `readFile()` (`lib/storage/files.ts`) already classifies any given `path` as one of `file` (loads normally), `type_mismatch` (a folder — FR-008), or `not_found` (FR-007); this feature's UI changes only add handling for the `type_mismatch` case, which was already returned by the API but not yet distinguished in `FileEditor.tsx`'s UI.

## Changed Client-Side State

### `EditorApp`'s open-file state (was: local React state; now: derived from the URL)

| Before | After |
|---|---|
| `const [selectedPath, setSelectedPath] = useState<string \| null>(null)` | `const selectedPath = pathname === "/files" ? null : pathname.slice("/files/".length)`, derived from `usePathname()` |
| Set only via `setSelectedPath(path)` inside `handleSelectFile` | Set via `router.push`/`router.replace` to a new `/files/<path>` URL (research.md §3) |

This is a state-ownership change, not a new entity: the value's type (`string | null`) and meaning (which file is open) are unchanged; only where it's stored (URL vs. component state) changes, which is what makes it externally addressable.

### `FileTree`'s expansion state (extended, not new)

Each `DirectoryNode`'s existing `expanded: boolean` state gains one additional trigger for defaulting to `true`: being an ancestor of an incoming `expandToPath` prop (research.md §3), alongside the existing "root is always expanded" rule. No new persisted or shared state — this remains per-node, in-memory, exactly as today.

## No Key Entities section in spec.md

The feature spec's Key Entities section lists only the pre-existing "File Path," reused unchanged — see spec.md's Assumptions ("Existing path validation/sanitization safeguards in the storage layer are the basis... this feature does not need to invent a new access model").
