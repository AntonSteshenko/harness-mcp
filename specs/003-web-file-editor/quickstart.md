# Quickstart: Web File Explorer & Markdown Editor

**Input**: [spec.md](./spec.md), [contracts/api-routes.md](./contracts/api-routes.md)

This guide validates the feature end-to-end against the acceptance scenarios in spec.md. It assumes `app/editor` (see plan.md Project Structure) has already been implemented per tasks.md.

## Prerequisites

1. The spec 001 local storage stack is running: `docker compose up -d`.
2. Dependencies installed: `npm install`.
3. The Next.js app running: `npm run dev`.
4. A browser, and at least one `.md` file and one non-Markdown text file already present in storage (create them via the MCP tools from spec 002, or via `PUT /api/file` directly once this feature exists) — e.g. `notes/hello.md` and `notes/plain.txt`.

## 1. Browse and view (validates User Story 1, FR-001–FR-002, SC-001)

Open `http://localhost:3000/editor` in a browser.

Expected: the folder/file tree loads, showing the existing structure (e.g. `notes/`).

Expand `notes/`.

Expected: it expands in place (no full page reload) showing `hello.md` and `plain.txt`.

Click on an empty folder (create one first via the MCP tools if none exists).

Expected: it expands to show clearly that it's empty, not a stuck/broken state.

Click `hello.md`.

Expected: its content loads and displays within a few clicks total from page load (SC-001).

## 2. Edit Markdown with live preview (validates User Story 2, FR-003–FR-005, FR-008–FR-010, SC-002–SC-004)

With `hello.md` open, confirm the raw Markdown text and a rendered preview are shown side by side.

Type a change (e.g. add `# New Heading`).

Expected: the preview updates to show the rendered heading in well under half a second (SC-002); an unsaved-changes indicator appears (FR-008).

Click Save.

Expected: a success confirmation appears within ~2 seconds (SC-003); the unsaved-changes indicator clears.

Reload the page and reopen `hello.md`.

Expected: the saved change is present (persisted to storage).

Make another change, then try to open `plain.txt` without saving.

Expected: a warning prompts before discarding the change (FR-009).

Stop the storage stack (`docker compose stop`, from the spec 001 project root), make a change, and try to save.

Expected: a clear error is shown (FR-010, SC-004) and the typed change remains visible in the editor (not lost). Restart storage (`docker compose up -d`) afterward and confirm a subsequent save succeeds.

## 3. Edit non-Markdown text (validates User Story 3, FR-006–FR-007)

Open `plain.txt`.

Expected: it opens in a plain-text editor with no Markdown rendering/preview pane.

Edit its content and save.

Expected: success is confirmed; reloading and reopening the file shows the saved change persisted (SC-005).

## 4. Unsupported (binary) file handling (validates FR-011, Edge Cases)

Upload/create a binary file in storage (e.g. a small image) via the MCP tools, then open it from the tree.

Expected: a clear "this file can't be edited here" message is shown instead of a garbled editor.

## 5. File removed elsewhere while open (validates Edge Cases)

With a file open in the editor, delete it via the MCP tools (a different "client") without closing the editor tab.

Expected: attempting to save afterward shows a clear "not found"-style error rather than silently creating an unexpected file or failing invisibly.
