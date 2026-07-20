# Research: Web File Explorer & Markdown Editor

**Input**: [spec.md](./spec.md)

All unknowns from the Technical Context have been resolved below; no `NEEDS CLARIFICATION` markers remain.

## 1. Where this lives

**Decision**: A new route in the same Next.js app introduced by spec 002 (`app/editor/`), plus two internal API routes (`app/api/tree/route.ts`, `app/api/file/route.ts`) that the editor UI calls via `fetch`. No new project/app is created.

**Rationale**: The spec explicitly requires reusing the existing storage layer (FR-012) and lives in "the same Next.js app del server MCP" per the user's request. Adding routes to the existing app is the direct, zero-duplication way to do that — `app/editor/*` (React components, client-rendered) call `app/api/*` (thin wrappers around `lib/storage/*`), which is the same storage code the MCP tools already use.

**Alternatives considered**:
- A separate app/service for the UI — rejected: duplicates the storage layer or requires cross-service calls for no benefit, and contradicts the explicit "same Next.js app" request.
- Driving the UI through the MCP protocol itself (i.e., the browser as an MCP client) — rejected: MCP is designed for AI-agent tool calling, not for a human-facing browser UI; going through `lib/storage/*` directly via ordinary REST-ish routes is far simpler and is exactly what those functions are for.

## 2. File tree browsing without full page reloads

**Decision**: `GET /api/tree?path=<dir>` wraps `listDirectory` (lib/storage/directories.ts) and returns its `{ files, directories }` JSON. The tree is a client component that fetches this lazily per-directory as the user expands nodes (not one deep recursive fetch up front), and re-renders in place.

**Rationale**: Directly satisfies FR-001 and acceptance scenario 2 ("without needing a full page reload"). Lazy per-directory fetching (rather than recursively walking the whole tree eagerly) keeps the initial page load fast regardless of how much is stored, and reuses `listDirectory`'s existing one-level "direct children only" semantics (spec 002) with no new storage logic.

**Alternatives considered**:
- Eagerly fetching the entire tree recursively on load — simpler client code, but scales badly and duplicates work `listDirectory` already does per-level; rejected.
- Server-rendering the tree via Next.js Server Components with full navigations per folder click — would satisfy the letter of "browsable tree" but conflicts with "without needing a full page reload" and with wanting instant expand/collapse.

## 3. Reading and saving file content

**Decision**: `GET /api/file?path=<file>` wraps `readFile`; `PUT /api/file` (body `{ path, content }`) wraps `updateFile` (both from lib/storage/files.ts). No new file-creation path is exposed here — spec 003 only edits *existing* files (Assumptions), so `updateFile`'s "must already exist" semantics (spec 002 FR-004) are exactly right and need no change.

**Rationale**: Directly reuses spec 002's existing, already-validated functions — FR-012 in spec 003 requires exactly this. `updateFile` already returns `not_found`/`type_mismatch` errors in the shape needed to satisfy FR-010 (clear save-failure errors).

**Alternatives considered**: None meaningfully different — this is the direct, minimal mapping of "view/edit an existing file" onto the storage functions that already exist for exactly that purpose.

## 4. Markdown split-view editor

**Decision**: Use `@uiw/react-codemirror` (CodeMirror 6 React wrapper) with `@codemirror/lang-markdown` for the raw-text pane, and `react-markdown` + `remark-gfm` for the live-rendered preview pane, laid out side by side (FR-003).

**Rationale**: CodeMirror 6 is a well-established, comparatively lightweight (versus Monaco/VS Code's engine) editor component with first-class Markdown syntax highlighting, matching "editor Markdown dedicato" without the bundle-size cost of a full VS Code-derived editor (this was explicitly the tradeoff discussed and accepted with the user before writing this spec). `react-markdown` renders Markdown to React elements from a parsed AST rather than injecting raw HTML, so the live preview is safe by construction (no `dangerouslySetInnerHTML`); `remark-gfm` adds GitHub-flavored Markdown (tables, strikethrough, task lists) since that's the Markdown flavor most people actually write in.

**Alternatives considered**:
- Monaco Editor — rejected earlier in conversation with the user specifically for this reason (heavier bundle, general-purpose code editor rather than Markdown-focused).
- A bare `<textarea>` for the Markdown pane too — would work and is even simpler, but "editor Markdown dedicato" and the "IDE-style" framing call for at least basic Markdown syntax highlighting, which a plain textarea can't provide; CodeMirror is the light-weight way to get that.
- Rendering the preview via `marked`/`markdown-it` + `dangerouslySetInnerHTML` — faster to wire up, but reintroduces the small persistent XSS-review burden `react-markdown` avoids by design; not worth it for a feature this size.

## 5. Non-Markdown fallback editor

**Decision**: A plain, uncontrolled-styling `<textarea>` for any file opened that isn't `.md` (US3, FR-006).

**Rationale**: The spec's own words are "editor di testo semplice" (simple text editor) — a `<textarea>` is the literal, zero-dependency fulfillment of that, and keeps this fallback path free of any editor-library weight or complexity.

**Alternatives considered**: Reusing CodeMirror generically for all files with per-extension language modes — more "IDE-like" but explicitly heavier than what was asked for the fallback case; rejected in favor of matching the stated "semplice" (simple) requirement.

## 6. Detecting non-text (binary) files

**Decision**: `GET /api/file` returns each file's content as text (spec 002's `readFile` already does `Body.transformToString()`); the editor UI treats a file as "not text-editable" when the read fails, when the response's content contains the Unicode replacement character (U+FFFD) indicating a failed UTF-8 decode, or when the file extension is in a small denylist of known-binary types (e.g., images) — whichever triggers first — and shows a clear "this file can't be edited here" message (FR-011) instead of opening an editor.

**Rationale**: There's no fully reliable way to detect "binary" from content alone without deeper inspection, but this project's storage layer treats content as opaque text already (spec 002 Assumptions), so a pragmatic combination of decode-failure detection plus a small extension denylist covers the realistic cases (images, archives) without adding a heavyweight content-sniffing dependency for a feature whose core ask is Markdown editing.

**Alternatives considered**:
- A dedicated binary-detection library (e.g., sniffing magic bytes) — more robust, but meaningfully more machinery than this feature's scope justifies; the lightweight heuristic is a reasonable, documented tradeoff.
- Always attempting to open every file as text — rejected, directly violates FR-011 and the corresponding edge case.

## 7. Unsaved-changes tracking and warnings

**Decision**: The open file's "Editor Session" (spec's Key Entities) is plain client-side React state: `{ path, loadedContent, currentContent }`; `dirty = currentContent !== loadedContent`. Switching files or attempting to close/reload the tab while `dirty` triggers a confirmation prompt (`window.confirm` for in-app navigation; the standard `beforeunload` browser dialog for tab close/reload) before proceeding.

**Rationale**: Directly implements FR-008/FR-009 with no server involvement needed — this is inherently client-side state since it only exists "in the browser" (spec's Key Entities definition of Editor Session) until a save occurs.

**Alternatives considered**: Persisting draft state to the server/local storage for crash recovery — not requested, adds real complexity (draft lifecycle, cleanup); out of scope.

## 8. Validation approach

**Decision**: Manual browser-driven validation against the acceptance scenarios, documented as a runnable walkthrough in `quickstart.md` — consistent with specs 001 and 002, which used scripted/manual walkthroughs rather than an automated test suite since none was requested.

**Rationale**: This feature is a thin UI + two API routes over already-validated storage functions (spec 002); the highest-value verification is confirming the actual browser experience (tree navigation, live preview timing, save flow, error states) end to end, which a browser-driven walkthrough covers directly.

**Alternatives considered**: Component/unit tests for the tree and editor components — a reasonable future addition, not a plan blocker (no test framework exists in this repo yet).
