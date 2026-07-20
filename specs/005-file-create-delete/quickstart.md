# Quickstart: File Delete & Create

**Input**: [spec.md](./spec.md), [contracts/api-routes.md](./contracts/api-routes.md)

This guide validates the feature end-to-end against the acceptance scenarios in spec.md. It assumes `app/editor/FileTree.tsx`'s delete/create additions and the API route changes (see plan.md Project Structure) have already been implemented per tasks.md.

## Prerequisites

1. The spec 001 local storage stack is running: `docker compose up -d`.
2. The Next.js app running: `npm run dev`.
3. A browser at `http://localhost:3000/editor`, with at least one folder already in storage (spec 003) containing at least one file, to exercise delete on.

## 1. Create a new file (validates User Story 2, FR-004, FR-010, SC-002)

Navigate to a folder in the tree and click "New file". Enter a name, e.g. `notes.md`.

Expected: within a couple seconds, the new file appears in that folder in the tree and opens automatically in the editor, empty and ready for typing.

## 2. Cancel file creation (validates User Story 2, Acceptance Scenario 3)

Click "New file" again and either enter nothing or cancel the prompt.

Expected: no new file appears in the tree.

## 3. Overwrite confirmation on create (validates User Story 2, FR-006)

Click "New file" and enter the same name as the file created in step 1 (`notes.md`).

Expected: a confirmation prompt appears before anything is sent; declining leaves the existing file's content untouched; confirming replaces it with a new empty file.

## 4. Reject a name with a path separator (validates Edge Cases, FR-007)

Click "New file" (or "New folder") and enter a name containing `/`, e.g. `sub/notes.md`.

Expected: a clear message rejects the name; no file or folder is created.

## 5. Create a new folder (validates User Story 3, FR-005, SC-003)

Click "New folder" on a folder in the tree. Enter a name, e.g. `drafts`.

Expected: within a couple seconds, the new subfolder appears in the tree under that folder.

## 6. Re-create an existing folder (validates User Story 3, Acceptance Scenario 2)

Click "New folder" again and enter the same name as step 5 (`drafts`).

Expected: no error; the tree still shows exactly one `drafts` folder with nothing lost inside it.

## 7. Folder name collides with an existing file (validates User Story 3, Acceptance Scenario 3)

Click "New folder" and enter the same name as the file created in step 1 (`notes.md`).

Expected: a clear error is shown; no folder is created.

## 8. Delete a file (validates User Story 1, FR-001, FR-002, SC-001, SC-004)

Click "Delete" on any file in the tree (e.g. `notes.md` from step 1) and confirm the prompt.

Expected: the file disappears from the tree and is no longer readable (re-fetching it returns not-found).

## 9. Cancel a delete (validates User Story 1, Acceptance Scenario 2)

Click "Delete" on a file and dismiss/cancel the confirmation prompt.

Expected: the file remains untouched in the tree.

## 10. Delete the file currently open in the editor (validates User Story 1, FR-003)

Open a file in the editor, then delete that same file from the tree and confirm.

Expected: the editor pane closes/clears that file — it no longer shows the deleted file's content as if still open.

## 11. Storage unreachable during create/delete (validates FR-009, Edge Cases)

Stop the storage stack (`docker compose stop`, from the spec 001 project root). Try "New file", "New folder", and "Delete".

Expected: each shows a clear error rather than hanging or silently failing. Restart storage (`docker compose up -d`) afterward and confirm all three actions succeed again.
