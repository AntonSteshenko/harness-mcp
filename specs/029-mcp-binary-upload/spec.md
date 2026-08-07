# Feature Specification: MCP Binary File Upload Tool

**Feature Branch**: `029-mcp-binary-upload`

**Created**: 2026-08-07

**Status**: Draft

**Input**: User description: "Aggiungere un nuovo strumento MCP che permetta a un agente collegato di caricare file binari (PDF, immagini, documenti Office, ecc.) nello storage, analogamente a quanto già possibile da browser (spec 028). Il contenuto binario deve arrivare codificato (es. base64) ed essere decodificato correttamente nei byte reali — non trattato come testo UTF-8 come fanno oggi create_file/update_file — così il file caricato via MCP risulti byte-per-byte identico all'originale." (Add a new MCP tool letting a connected agent upload binary files — PDF, images, Office documents, etc. — into storage, the same way a human already can from the browser (spec 028). The binary content must arrive encoded, e.g. base64, and be decoded correctly into real bytes — not treated as UTF-8 text the way today's create_file/update_file are — so the file uploaded via MCP ends up byte-for-byte identical to the original.)

## Clarifications

### Session 2026-08-07

- Q: Should this new tool enforce the same file-type allow-list and 25 MB size cap that the browser upload (spec 028) enforces, or remain unrestricted like today's MCP text tools? → A: Enforce the same allow-list and 25 MB cap as the browser upload, for a consistent security posture across every upload path into storage.
- Q: Should reading a binary file back via MCP work by changing the existing `read_file` tool's behavior, or by adding a separate, dedicated tool for binary reads? → A: Keep `read_file` text-only — it rejects binary files with a clear error (instead of today's silent corruption) — and add a new, separate tool dedicated to reading binary content back as base64.
- Q: Should the new binary upload capability be one tool (create-or-overwrite) or two tools mirroring the existing `create_file`/`update_file` text pair? → A: One tool — creates if the path is free, overwrites if a file already exists there — confirming the spec's existing default (no separate "update" variant needed).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Upload a binary file via MCP (Priority: P1)

A connected AI agent, acting on the owner's behalf, has binary content it needs to place into storage — for example, a PDF report it generated, an image it was given, or a document a third-party system handed it — and needs a way to store it exactly as-is, without corrupting it, the same way a human can already do by uploading through the browser.

**Why this priority**: This is the entire point of the request — today an agent has no way to get binary content into storage intact at all; the existing MCP file tools only handle text. Without this, agents remain unable to complete any workflow that involves producing or relaying a non-text file.

**Independent Test**: Can be fully tested by calling the new tool with a known binary file's content (base64-encoded) and a target path, then retrieving that same file (e.g., via the existing browser download action from spec 028, or a byte-level storage check) and confirming its content is identical to the original, unmodified file.

**Acceptance Scenarios**:

1. **Given** a valid target path and a binary file's content correctly base64-encoded, **When** the agent calls the upload tool, **Then** the file is stored at that path and its content, once retrieved, is byte-for-byte identical to the original file.
2. **Given** a target path where a file already exists, **When** the agent calls the upload tool for a new binary file at that path, **Then** the existing file is overwritten, consistent with how the existing text-file creation tool already behaves.
3. **Given** a target path where a directory already exists, **When** the agent calls the upload tool, **Then** the call fails clearly without overwriting or corrupting anything, consistent with the existing text-file creation tool's behavior in the same situation.
4. **Given** content that is not valid base64, **When** the agent calls the upload tool, **Then** the call fails with a clear, specific reason and nothing is written to storage.
5. **Given** a file type outside the allow-list used by the browser upload (spec 028), **When** the agent attempts to upload it, **Then** the call is rejected with a clear reason naming the unsupported type, and nothing is written to storage.
6. **Given** decoded content larger than the 25 MB per-file limit used by the browser upload (spec 028), **When** the agent attempts to upload it, **Then** the call is rejected with a clear size-related reason, and nothing is written to storage.

---

### User Story 2 - Read a binary file's content back via MCP (Priority: P2)

An agent needs to retrieve the actual content of a binary file already in storage — one it uploaded itself, or one a human uploaded via the browser (spec 028) — for example to verify an upload succeeded, or to relay that file's content elsewhere. It does this with a new, separate tool dedicated to binary content, distinct from the existing text-oriented reading tool.

**Why this priority**: Without this, an agent could write binary files via User Story 1 but could never reliably read one back through MCP — today's existing read tool silently returns corrupted, unusable text for any binary file, which undermines trust in the whole upload capability. This is a necessary complement to User Story 1, not an independent feature, so it ranks just below it.

**Independent Test**: Can be fully tested by uploading a known binary file (via User Story 1, or via the browser) and then reading it back through MCP with the new binary-read tool, confirming the returned content, once decoded, is byte-for-byte identical to the original — and separately, confirming the existing text-reading tool now fails clearly (rather than returning corrupted text) if pointed at that same binary file.

**Acceptance Scenarios**:

1. **Given** a binary file already in storage, **When** the agent calls the new binary-read tool on it, **Then** the response contains that file's exact content in a form the agent can decode back to the original bytes (base64), rather than corrupted or garbled text.
2. **Given** a text file already in storage, **When** the agent reads it with the existing text-reading tool, **Then** the response behaves exactly as it does today — plain text content, no change for existing text-file workflows.
3. **Given** a binary file already in storage, **When** the agent calls the existing text-reading tool on it (instead of the new binary-read tool), **Then** the call fails with a clear, specific error explaining the file isn't text-readable, instead of returning corrupted or garbled content as it does today.

---

### Edge Cases

- What happens when the agent declares a file extension inconsistent with the actual decoded content (e.g., names it `.pdf` but the bytes are something else entirely)? The upload should still succeed if the declared extension is on the allow-list — this tool trusts the declared path's extension the same way the browser upload does, and does not attempt to independently verify content against its extension.
- What happens when the base64 content is technically valid but decodes to an empty file? Treated as a valid (if unusual) zero-byte upload, consistent with how an empty text file can already be created today.
- What happens when the agent tries to upload a batch of multiple binary files in one call? Out of scope for this feature — each call uploads exactly one file, mirroring today's single-file `create_file`/`update_file` tools; an agent uploading several files makes several calls.
- What happens when either new tool (binary upload or binary read) is disabled by the owner (existing per-tool disable mechanism)? The call fails the same way any other disabled tool call does today — no special case.
- What happens when the same oversized-content or disallowed-type rejection scenario occurs mid-way through a large base64 payload transfer? The call still fails cleanly with no partial write — nothing is stored unless the entire decoded, validated file is written successfully.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a new MCP tool that accepts a target storage path and base64-encoded file content, and writes the decoded bytes to that path.
- **FR-002**: The system MUST decode the provided content as base64 into raw bytes before storing it, never treating it as UTF-8 text, so binary content is preserved exactly.
- **FR-003**: The system MUST reject content that is not valid base64 with a clear, specific error, writing nothing to storage.
- **FR-004**: The system MUST overwrite an existing file at the target path, consistent with the existing text-file creation tool's behavior.
- **FR-005**: The system MUST reject the call (without writing anything) when the target path is already occupied by a directory, consistent with the existing text-file creation tool's behavior.
- **FR-006**: The system MUST reject uploads whose target path's file type is outside the same allow-list of recognized safe types used by the browser upload (spec 028), with a clear reason naming the unsupported type.
- **FR-007**: The system MUST reject uploads whose decoded content exceeds the same 25 MB per-file limit used by the browser upload (spec 028), with a clear size-related reason.
- **FR-008**: Both new tools (binary upload and binary read) MUST be registered the same way every other MCP tool is (subject to the existing per-tool enable/disable mechanism and the existing bootstrap description framing), requiring no new authorization or gating mechanism.
- **FR-009**: The system MUST provide a new, separate MCP tool (distinct from the existing text-reading tool) for reading a binary file's exact content, returning it in a form that round-trips exactly back to the original bytes (base64-encoded).
- **FR-010**: The existing file-reading MCP tool MUST continue to behave exactly as it does today for text files (no change in response shape or content), and MUST reject binary files with a clear, specific error instead of today's behavior of silently decoding them as UTF-8 text and returning corrupted content.
- **FR-011**: The system MUST NOT attempt to verify that a file's actual decoded content matches its declared extension — the declared target path's extension alone determines allow-list and type handling, consistent with the browser upload.

### Key Entities

- **Binary File Upload Request**: The input to the new MCP tool — a target storage path and base64-encoded content. Decodes to the same "Stored File" entity already defined in spec 028 (raw bytes, inferred content type from the target path's extension).
- **Binary-Safe Read Result**: The output of the new, dedicated binary-read tool — a file's exact bytes, base64-encoded, that the calling agent can decode back to the original; distinct from the plain-text result the existing text-reading tool returns for text files, and distinct from that same tool's new clear-error response when pointed at a binary file.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of binary files uploaded via the new MCP tool, when subsequently read back (via MCP or via the browser download action from spec 028), are byte-for-byte identical to the original file.
- **SC-002**: 100% of upload attempts with invalid base64 content, disallowed file types, or oversized content are rejected with a clear, specific reason, with nothing written to storage.
- **SC-003**: An agent can complete a full upload-then-verify round trip (upload a binary file, then read it back) using only MCP tool calls, with no dependency on the browser UI.
- **SC-004**: Reading any pre-existing text file via MCP continues to return correct, unchanged content in 100% of cases after this feature ships.
- **SC-005**: 100% of attempts to read a binary file with the existing text-reading tool result in a clear error rather than corrupted or garbled content being returned.

## Assumptions

- The new tool creates or overwrites a single file per call — there is no batch/multi-file variant, mirroring the existing single-file `create_file`/`update_file` tools.
- The new tool's overwrite semantics mirror `create_file` exactly (overwrite an existing file, fail on an existing directory) — confirmed by explicit decision (Clarifications).
- The allow-list and 25 MB size limit are the exact ones already defined for the browser upload in spec 028, applied here for consistency rather than redefined independently — a file type or size rejected from the browser is rejected here too, and vice versa.
- "Byte-for-byte identical" is verified against the already-existing retrieval paths from spec 028 (the browser's download action, or direct storage inspection) as well as this feature's own new dedicated binary-read tool (User Story 2) — this feature does not introduce a new verification mechanism beyond making existing ones correct for binary content.
- Existing MCP authorization (the owner's already-established OAuth/personal-access-token connection) is reused unchanged — this feature does not introduce a new permission tier; any agent already able to call `create_file` today is able to call this new tool.
