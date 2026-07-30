# Data Model: Live File Sync in the Files Interface

No new persisted storage entity is introduced — files and directories remain S3 objects exactly as modeled in specs 001–003. This feature only adds client-side session state and one new metadata field surfaced from data S3 already returns.

## Folder Listing Snapshot (client-side, per expanded directory)

The existing `TreeListing` shape (`FileTree.tsx`), unchanged:

```ts
interface TreeListing {
  files: Array<{ path: string; size: number; lastModified: string }>;
  directories: Array<{ path: string }>;
}
```

**Change**: this is now held in SWR's cache (keyed by `` `/api/tree?path=${path}` ``) instead of local `useState`. No field changes. SWR diffs the previous and new snapshot internally (deep-equal) to decide whether to re-render; the application code does not need to hand-write a diff algorithm — React's existing `key={f.path}` / `key={d.path}` list rendering (`FileTree.tsx:579,594`) reconciles the DOM for whatever entries did change.

**Lifecycle**: fetched when a directory is expanded (`expanded === true`); revalidated every `refreshInterval` (15s) while visible; revalidated immediately via `mutate()` after this directory's own upload/create/delete/rename action.

## Open File Sync State (client-side, extends `EditorSession`)

Today's `EditorSession` (`FileEditor.tsx`):

```ts
interface EditorSession {
  path: string;
  loadedContent: string;
  currentContent: string;
  kind: "markdown" | "text" | "csv";
  saveState: "idle" | "saving" | "error";
  saveError: string | null;
}
```

**Change**: gains two fields —

```ts
interface EditorSession {
  // ...existing fields unchanged...
  loadedEtag: string;
  externalChange: { etag: string; dismissed: boolean } | null;
}
```

- `loadedEtag`: the `ETag` of the version currently reflected in `loadedContent`, captured from the `GET /api/file` response at load time (and updated again on every successful save, and on every accepted "reload external version").
- `externalChange`: `null` when the open file is in sync with (or ahead of, via local unsaved edits on) the last-loaded version. Non-null when the background metadata poll has detected an `ETag` on the server that differs from `loadedEtag` while `dirty === true` — i.e. the *external change vs. local unsaved edit* conflict described in User Story 2. `dismissed: true` after the user picks "Keep mine", suppressing the banner for *that* `etag` specifically (a further external change produces a new `etag` and re-arms the banner).

**State transitions**:

| Current state | Event | New state |
|---|---|---|
| `externalChange: null`, `dirty: false` | metadata poll returns a new `etag` | content silently refetched; `loadedContent`/`currentContent`/`loadedEtag` updated; `externalChange` stays `null` |
| `externalChange: null`, `dirty: true` | metadata poll returns a new `etag` | `externalChange: { etag, dismissed: false }` (banner shown) |
| `externalChange: { etag, dismissed: false }` | user clicks "Reload external version" | content refetched and adopted; `loadedContent = currentContent`; `loadedEtag = etag`; `externalChange: null` |
| `externalChange: { etag, dismissed: false }` | user clicks "Keep mine" | `externalChange: { etag, dismissed: true }` (banner hidden, edits untouched) |
| `externalChange: { etag: e1, dismissed: true }` | metadata poll returns yet another new `etag` e2 ≠ e1 | `externalChange: { etag: e2, dismissed: false }` (banner re-shown for the newer change) |
| any state | user clicks Save (existing `handleSave` flow) | on success: `loadedContent = currentContent`, `loadedEtag` updated from the `PUT` response's new `etag`, `externalChange: null` (the save itself resolves any pending conflict by overwriting the external version, per spec's Acceptance Scenario 4 for User Story 2) |

## File Metadata (server-side, extends `FileMetadata`)

Today's `FileMetadata` (`lib/storage/files.ts`):

```ts
interface FileMetadata {
  path: string;
  size: number;
  lastModified: string;
}
```

**Change**: gains `etag: string` (S3's `ETag`, quoted hex string, read from `HeadObjectCommand`/`GetObjectCommand`/`PutObjectCommand` responses — all three already available on the AWS SDK response objects used by `readFile()`, `createFile()`, `updateFile()`). Purely additive; existing callers of these functions that don't look at `etag` are unaffected.
