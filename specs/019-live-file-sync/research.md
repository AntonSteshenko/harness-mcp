# Research: Live File Sync in the Files Interface

## 1. Client-side data layer: SWR

**Decision**: Adopt `swr` for both the tree listing (`DirectoryNode`) and the open-file editor (`FileEditor`), configured via a shared `<SWRConfig>` provider in `app/files/layout.tsx` with `refreshInterval: 15000` and `revalidateOnFocus: true`.

**Rationale**:
- SWR's documented default is `refreshWhenHidden: false` — polling automatically stops while `document.visibilityState !== 'visible'` and resumes when the tab regains focus, satisfying FR-006/SC-004 with zero custom visibility-tracking code (today's codebase has none).
- SWR performs a deep comparison (`compare` option, deep-equal by default) between previously-cached data and newly-fetched data before triggering a re-render. If a poll returns byte-identical JSON (nothing changed on the server), no re-render happens at all — satisfying FR-008/SC-005 (a "successful poll that found nothing new" must be invisible) for free.
- SWR's cache is keyed globally by request key and persists for the life of the `SWRConfig` provider, not per-component-instance state. Re-visiting a folder/file already fetched this session (even after the component fully unmounted, e.g. navigating away and back) shows the cached result instantly while revalidating in the background — this is exactly User Story 3, and is stronger than today's `DirectoryNode` local `entries` state (which is lost if the component itself is torn down, e.g. via a deep-link navigation that rebuilds the tree).
- `mutate(key)` gives an explicit, immediate revalidation call that bypasses the interval timer — this replaces today's manual `refreshEntries()` (called after upload/create/delete) with no loss of that guarantee (FR-009), and additionally avoids a redundant poll firing moments later.

**Alternatives considered**:
- **Hand-rolled `setInterval` + `useState`** (extending today's pattern in place): rejected — would require re-implementing visibility-pause, request deduping, and stale-while-revalidate caching by hand, in at least two components, for behavior SWR provides out of the box.
- **TanStack Query**: comparable feature set, but heavier (larger API surface, devtools, query-client boilerplate) for a single-page, single-owner tool with no other data-fetching needs in the app. SWR's smaller surface area fits the project's existing minimal-dependency style (no data-fetching library at all today).
- **No library, keep polling logic centralized in a custom hook**: rejected for the same reason as hand-rolled — reinventing cache/dedupe/visibility behavior without a clear benefit over an already-solved, small (~5kb), zero-dependency library built by the same team as Next.js.

## 2. Lightweight metadata check for the open file

**Decision**: Add a real HTTP `HEAD /api/file?path=...` handler alongside the existing `GET`/`PUT`/`POST`/`DELETE` on `app/api/file/route.ts`. It calls a new `getFileMetadata(path)` in `lib/storage/files.ts` (an `S3Client.send(new HeadObjectCommand(...))` call, mirroring the existing `headObjectExists` helper in `lib/storage/paths.ts`), and returns an empty body with the `ETag` and `Last-Modified` response headers set, or the same `not_found`/`type_mismatch` status codes as `GET` (empty body) on failure. The client polls this via its own small `useSWR` hook, keyed separately from the content fetch.

**Rationale**:
- `HeadObjectCommand` does not transfer the object body, so this check costs the same as an S3 metadata lookup regardless of file size — critical for FR-010 (never re-download full content just to check for a change), especially for larger markdown/CSV files.
- Real HTTP `HEAD` semantics (matching the user's explicit request) are the standard way to express "give me metadata, not the resource" — no new query parameter or endpoint shape to document/learn beyond what HTTP already defines.
- Two separate SWR keys (`HEAD /api/file?path=` for metadata, `GET /api/file?path=` for content) is the natural way to express "poll cheap, fetch expensive only when needed" in SWR: the metadata hook's `onSuccess` (or a `useEffect` watching its data) triggers `mutate()` on the content key only on an actual change.

**Alternatives considered**:
- **A `?metaOnly=true` query flag on the existing `GET`**: rejected — conflates two different response shapes (JSON-with-content vs. JSON-without) under one verb/route contract, and doesn't map to a standard HTTP idiom the way `HEAD` does.
- **Piggyback on the tree poll** (the containing folder's `lastModified` for this file, already returned by `GET /api/tree`): rejected as the primary mechanism — it would require new cross-component state sharing between `FileTree` and `FileEditor` (currently siblings coordinated only via `EditorApp`'s callbacks), for a change that's easy to express as a small, self-contained addition to `FileEditor` alone. (Not mutually exclusive with the chosen approach, but not needed given the HEAD endpoint is simple to add.)

## 3. Change-detection key: ETag vs. Last-Modified

**Decision**: Use S3's `ETag` as the authoritative "did this file change" signal, not `Last-Modified`.

**Rationale**: `GetObjectCommand` (used by the existing `readFile()`) and `HeadObjectCommand` (used by the new `getFileMetadata()`) both return `ETag` in the same string format (a quoted MD5 hex digest, for non-multipart uploads — true for the plain text/markdown/CSV files this editor handles) — so the value captured at load time and the value seen on a later poll are directly, exactly comparable. `Last-Modified`, by contrast, is HTTP-date formatted with **whole-second** precision when read back as a response header, while the JSON `GET /api/file` response today serializes it as a full-precision ISO string (`result.LastModified.toISOString()`, in `lib/storage/files.ts`) — comparing those two representations directly risks spurious mismatches (format) or missed changes within the same second (precision loss). `ETag` sidesteps both problems by being an opaque, exact-match string in both response shapes.

**Alternatives considered**:
- **`Last-Modified` only**: rejected as primary key per the precision/format mismatch above; still returned alongside `ETag` in the `HEAD` response for human-readable debugging/logging, but not used for the equality check.
- **Content hash computed client-side**: rejected — would require downloading full content to hash it, defeating the entire point of a lightweight check (FR-010).

## 4. Conflict handling for the open file

**Decision**: `FileEditor`'s existing `dirty` boolean (`currentContent !== loadedContent`, already computed today) gates the response to a detected `ETag` change:
- **`dirty === false`**: call `mutate(contentKey)` to silently refetch and adopt the new content — no user-visible interruption (FR-004).
- **`dirty === true`**: do not touch `currentContent`; set a local `externalChange: { etag, dismissed: false }` state that renders `ExternalChangeBanner` with two actions — "Reload external version" (discard local edits, adopt fetched content, clear dirty) and "Keep mine" (dismiss the banner; remember the dismissed `etag` so the same external revision doesn't re-trigger the banner on the next poll tick, but a *further* external change — a new `etag` — does).

**Rationale**: This reuses state (`dirty`, `loadedContent`/`currentContent`) and UI conventions (the existing `saveState: "error"` banner-style message, per `FileEditor.tsx`) already present in the component, rather than introducing a parallel conflict-resolution model. Remembering the dismissed `etag` (rather than suppressing all future notices once dismissed) ensures a user who dismisses one external change is still told about a *subsequent* one, per FR-005's intent that unsaved edits are protected but not silently stale forever.

**Alternatives considered**:
- **Always show a blocking modal on any external change**: rejected — the spec explicitly calls for a non-blocking notice (User Story 2, FR-005); a modal would interrupt typing.
- **Auto-merge or three-way diff**: out of scope per the spec's Assumptions (no live collaborative editing); the two-choice reload/keep model matches the stated requirement exactly without over-building.

## 5. Poll interval

**Decision**: 15 seconds, shared by the tree listing poll and the file-metadata poll, via one `SWRConfig`.

**Rationale**: SC-001 requires visibility within 30 seconds; a 15s interval gives roughly a 2x safety margin against jitter/network latency/S3 List latency while keeping request volume modest (4 requests/minute per open folder or open file, only while the tab is visible, per FR-006). This matches the spec's Assumption that "tens of seconds, not sub-second" freshness is an acceptable trade-off.

**Alternatives considered**:
- **Shorter interval (e.g. 5s)**: rejected — meaningfully higher S3 List/Head request volume for marginal freshness gain well past what SC-001 requires.
- **Longer interval (e.g. 30s, matching SC-001 exactly)**: rejected — leaves no safety margin; a single slow request or timer drift could push a real change past the 30s target.
- **Exponential backoff / adaptive interval**: rejected as unnecessary complexity for a single-owner tool with low request volume; a fixed interval is simpler to reason about and document.
