# Quickstart: Markdown Upload & Folder Download

**Input**: [spec.md](./spec.md), [contracts/api-routes.md](./contracts/api-routes.md)

This guide validates the feature end-to-end against the acceptance scenarios in spec.md. It assumes `app/editor/FileTree.tsx`'s upload/download additions and the two new API routes (see plan.md Project Structure) have already been implemented per tasks.md.

## Prerequisites

1. The spec 001 local storage stack is running: `docker compose up -d`.
2. Dependencies installed: `npm install` (pulls in the new `jszip` dependency).
3. The Next.js app running: `npm run dev`.
4. A browser, and locally on your machine: one standalone `.md` file, one non-Markdown file (e.g. `.txt`), and a local folder containing a mix of `.md` files in nested subfolders plus at least one non-`.md` file — for exercising both upload stories.
5. At least one folder already in storage (via `http://localhost:3000/editor`, spec 003) to upload into and later download from.

## 1. Upload a single Markdown file (validates User Story 1, FR-001, FR-004, FR-005, SC-001)

Open `http://localhost:3000/editor`, navigate to a folder, and click "Upload files".

Select your standalone `.md` file.

Expected: within a few seconds, a summary confirms 1 file uploaded, 0 skipped, and the file appears in the tree; opening it shows its original content unchanged.

## 2. Upload a mixed batch (validates User Story 1, FR-003, FR-005)

Click "Upload files" again and select both a `.md` file and the non-Markdown file together.

Expected: the summary reports 1 uploaded and 1 skipped, naming the skipped file and that it wasn't a Markdown file; only the `.md` file appears in the tree.

## 3. Overwrite confirmation (validates User Story 1, FR-006)

Click "Upload files" and select a `.md` file whose name matches one already in that folder (e.g. re-upload the file from step 1, possibly with edited content).

Expected: a confirmation prompt names the conflicting file before anything is sent; declining leaves the existing file's content untouched; confirming overwrites it, and reopening the file shows the new content.

## 4. Upload a folder of Markdown files (validates User Story 2, FR-002, FR-003, FR-005)

Click "Upload folder" on a target folder in the tree and pick your local folder containing nested `.md` files and a non-`.md` file.

Expected: the same subfolder structure appears under the target folder in the tree, containing only the `.md` files with their original content; the summary reports the correct uploaded/skipped counts, matching the non-`.md` files present in the local folder.

## 5. Upload an empty/no-Markdown folder (validates User Story 2, Edge Cases)

Click "Upload folder" and pick a local folder that has no `.md` files anywhere in it (empty, or only non-Markdown files).

Expected: the user is told there was nothing to upload; no new folders or files appear in the tree.

## 6. Download a folder as a zip (validates User Story 3, FR-007, FR-008, SC-003)

On a folder in the tree containing `.md` files across nested subfolders (e.g. the one populated in step 4), click "Download folder".

Expected: a single `.zip` file downloads; extracting it locally shows the same subfolder structure and every `.md` file with content matching what's in storage, and no non-`.md` files (there shouldn't be any, since only `.md` files can be uploaded/stored via this UI).

## 7. Download an empty folder (validates User Story 3, Edge Cases, FR-009, SC-005)

Click "Download folder" on a folder with no files or subfolders (create one via spec 003's tooling if none exists).

Expected: a clear "nothing to download" message is shown; no file is saved to the browser's downloads.

## 8. Storage unreachable during upload/download (validates FR-010, Edge Cases)

Stop the storage stack (`docker compose stop`, from the spec 001 project root). Try both "Upload files" and "Download folder".

Expected: both show a clear error rather than hanging or silently failing. Restart storage (`docker compose up -d`) afterward and confirm both actions succeed again.
