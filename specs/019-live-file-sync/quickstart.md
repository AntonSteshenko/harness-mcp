# Quickstart: Validating Live File Sync

No automated test suite exists in this project (see plan.md Technical Context); validate manually against the running dev server, simulating an "external change" via a second channel (a second browser tab, or the MCP tools) while the files UI is open in a first tab.

## Prerequisites

- `cd frontend && npm install` (picks up the new `swr` dependency)
- `npm run dev`, sign in as the owner, open `/files`
- A second way to change the same S3-backed files independently of the first browser tab — either:
  - a second browser tab/window at `/files` (simplest), or
  - the MCP tools (`create_file`/`update_file`/`delete_file`) against the same bucket, if you have an MCP client configured

## Scenario 1 — Tree updates in the background (User Story 1, SC-001)

1. In tab A, expand a folder (e.g. the root).
2. In tab B (or via MCP), create a new file inside that same folder.
3. In tab A, without reloading or touching anything, wait up to ~15–20s.
4. **Expected**: the new file appears in tab A's tree. Other expanded folders, scroll position, and any open row menus in tab A are undisturbed.
5. Repeat for deleting a file from tab B — it should disappear from tab A's tree within the same window.

## Scenario 2 — Background tab pauses polling (FR-006, SC-004)

1. In tab A, expand a folder, then switch to a different browser tab (or minimize the window) so tab A is hidden.
2. In tab B, add a file to that folder.
3. Open the browser devtools Network panel filtered to `/api/tree` *before* switching back to tab A — confirm no new requests fire while tab A is hidden.
4. Switch back to tab A.
5. **Expected**: a request fires promptly on refocus (`revalidateOnFocus`), and the new file appears shortly after — without having polled while hidden.

## Scenario 3 — Open file updates silently when not dirty (User Story 2, FR-004)

1. In tab A, open a file in the editor; do not type anything (no unsaved edits).
2. In tab B, edit and save that same file with different content.
3. In tab A, wait up to ~15–20s.
4. **Expected**: the editor's displayed content updates to the new text automatically, no confirmation prompt, no visible flash/reload of the whole page.

## Scenario 4 — Open file shows a conflict notice when dirty (User Story 2, FR-005)

1. In tab A, open a file and type an edit — do **not** click Save (so `dirty === true`, shown by the existing "unsaved changes" indicator).
2. In tab B, edit and save that same file with different content.
3. In tab A, wait up to ~15–20s.
4. **Expected**: tab A's text box still shows *your* unsaved edit, untouched. A non-blocking banner appears: "This file changed externally" with two actions.
5. Click "Reload external version": **expected** — your edit is replaced with tab B's saved content, banner disappears.
6. Repeat steps 1–3, then click "Keep mine" instead: **expected** — banner disappears, your edit remains in the box, "unsaved changes" indicator still shown.
7. With the banner dismissed via "Keep mine", change the file *again* from tab B: **expected** — the banner reappears (a new external revision re-arms it even though the previous one was dismissed).
8. From either state, click Save in tab A: **expected** — your content is written, overwriting whatever was on the server; the banner (if any) clears.

## Scenario 5 — Instant re-visit from cache (User Story 3, SC-003)

1. In tab A, expand a folder (data loads, brief loading state visible).
2. Collapse it, then re-expand it.
3. **Expected**: contents appear instantly, no loading indicator, since SWR already has this key cached from step 1.
4. Open a file, note its content. Close it (select a different file), then re-select the original file.
5. **Expected**: content appears instantly on re-selection within the same session.

## Scenario 6 — A single failed poll doesn't surface an error (FR-008, SC-005)

1. With a folder expanded or a file open, use devtools to block requests to `/api/tree` or `/api/file` for a few seconds (Network conditions → block request URL, or toggle offline briefly) to force exactly one poll to fail.
2. Restore connectivity before the next interval tick.
3. **Expected**: no error banner/message appears for the failed tick; the last-known-good tree/content remains displayed; the next successful poll proceeds normally.
