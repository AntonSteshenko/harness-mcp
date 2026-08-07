# Quickstart: Upload and Browse Mixed File Types in Storage

Validates the feature end-to-end against a local dev environment. Assumes the existing local setup from the repo README (MinIO via `docker compose`, `frontend/.env.local` configured, owner login working).

## Prerequisites

```bash
docker compose up -d          # starts local MinIO (repo root)
cd frontend
npm install
npm run dev                   # http://localhost:3000
```

Sign in as the owner at `http://localhost:3000/oauth/login`, then open the file browser at `http://localhost:3000/files`.

## Scenario 1 — Upload mixed file types (User Story 1, FR-001–FR-004, SC-001)

1. In any folder, open the "Upload files" action and select a mix: one `.pdf`, one `.jpg`, one `.docx`, one `.xml`, one `.md` (reuse any small sample files, or create quick ones — e.g. export any short document as PDF, save a small screenshot as JPG).
2. **Expected**: an upload summary reports all 5 as uploaded; the folder listing shows all 5 within a few seconds (SC-001).
3. Re-upload the same `.pdf` with the same name. **Expected**: the existing overwrite-confirmation prompt appears (unchanged from today's `.md` behavior); confirming replaces it.

## Scenario 2 — Reject disallowed/oversized uploads (FR-002, FR-012, Edge Cases)

1. Attempt to upload a file with an extension outside the allow-list (e.g., rename any file to `.exe` or `.sh` for the test).
2. **Expected**: the batch result reports it as `failed` with an "unsupported type" message; any other valid files in the same batch still succeed.
3. Attempt to upload a file larger than 25 MB (e.g., a large sample video or a padded file).
4. **Expected**: `failed` with a size-related message; other files in the batch unaffected.

## Scenario 3 — Icons by file type (User Story 2, FR-005, FR-006, SC-003)

1. In a folder containing the files from Scenario 1 (PDF, JPG, DOCX, XML, MD) plus one file of an allowed-but-uncategorized type (e.g., `.zip`).
2. **Expected**: each file shows a distinct icon for its category (PDF, image, document, markup/code) and the `.zip` file shows the generic fallback icon — no two visibly different file types share the same icon, and nothing is blank/broken (SC-003).

## Scenario 4 — Open text files, block binary files (User Story 3, FR-007–FR-009, SC-004, SC-005)

1. Click the uploaded `.xml` file. **Expected**: its text content displays and is editable/savable, same as a `.md` file today (FR-007).
2. Click the uploaded `.pdf` file. **Expected**: no raw content is rendered; a clear "can't be viewed here" message appears instead (FR-008, SC-004).
3. Repeat for the `.docx` and `.jpg` files. **Expected**: same clear message, not garbled text.
4. Rename a genuinely binary file to end in `.txt` (mislabeling it) and upload it (if the allow-list blocks the rename's new extension mismatch scenario, instead test with an extensionless copy of a binary file, if your OS/browser permits selecting one). **Expected**: the content-sniffing fallback still catches it — the message appears rather than garbled text (FR-009).

## Scenario 5 — Retrieve binary files (FR-010, SC-006)

1. From the "can't be viewed here" message shown for the `.pdf` file (Scenario 4, step 2), use the new Open/Download action.
2. **Expected**: the PDF opens directly in a new browser tab using the browser's built-in PDF viewer (not a download prompt) — within about 2 seconds (SC-006).
3. Repeat for the `.jpg` file. **Expected**: same — opens inline in a new tab.
4. Repeat for the `.docx` file. **Expected**: downloads to disk instead (not a natively-renderable type per the clarified scope) rather than opening inline.

## Scenario 6 — Folder zip download includes new types (FR-011)

1. In the folder containing the uploaded PDF/JPG/DOCX/XML/MD files, use the existing "Download as zip" folder action.
2. **Expected**: the downloaded `.zip` contains all of them (not just the `.md` file, which was the only thing it would have included before this feature) — verify by opening the zip and checking file sizes/content match the originals, especially the binary ones (byte-for-byte integrity, SC-002).

## Scenario 7 — Existing operations still work on new types (FR-011)

1. Rename/move the uploaded `.pdf` file into a different folder. **Expected**: succeeds exactly like moving a `.md` file.
2. Delete the uploaded `.jpg` file. **Expected**: soft-deletes into `Trash` (spec 011 behavior, unchanged) and its content, once restored/inspected in `Trash`, is still byte-for-byte intact.
