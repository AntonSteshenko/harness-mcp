# Phase 0 Research: MCP Binary File Upload Tool

No `[NEEDS CLARIFICATION]` markers remain in the spec (all three resolved during `/speckit-clarify`). The research below covers technical decisions needed to implement the clarified requirements against this codebase's existing patterns — most of which spec 028 already established and this feature reuses rather than reinvents.

## 1. Reuse spec 028's storage layer and allow-list wholesale

**Decision**: `create_binary_file` calls the exact same `createFile` (now `Buffer`-based, `lib/storage/files.ts`) and the exact same `isAllowedExtension`/`MAX_UPLOAD_BYTES`/`mimeTypeForPath` (`lib/storage/fileTypes.ts`) the browser upload route (`app/api/upload/route.ts`) already calls. No new validation logic is written for this feature.

**Rationale**: The Clarification session explicitly decided this tool must enforce the same allow-list and size cap "for a consistent security posture across every upload path into storage." Importing the same functions makes that parity structural — a future change to the allow-list automatically applies to both paths — rather than something that has to be remembered and kept in sync by hand across two independent implementations.

**Alternatives considered**: A separate, MCP-specific allow-list/size constant — rejected outright; it's exactly the kind of duplication the Clarification decision was meant to prevent.

## 2. Base64 validation before storage

**Decision**: Reject the call with a new `invalid_content` error before calling `createFile` when the provided string fails a strict base64 check: `/^[A-Za-z0-9+/]*={0,2}$/.test(content)` and `content.length % 4 === 0`. `Buffer.from(content, "base64")` itself is intentionally *not* used as the validation step — Node's base64 decoder is lenient (it silently drops invalid characters and produces truncated output instead of throwing), which would let malformed input through as a corrupted file rather than a clean rejection.

**Rationale**: FR-003 requires a "clear, specific error" for invalid base64 with nothing written to storage. A lenient decode-and-hope approach would violate the "byte-for-byte identical" success criterion (SC-001) for any caller that made an encoding mistake — the file would be written, just wrong, which is worse than a clean rejection.

**Alternatives considered**: Wrapping the decode in a try/catch and trusting it to throw on bad input — rejected because `Buffer.from(str, "base64")` in Node does not throw on malformed base64; it degrades silently, which is the exact failure mode this validation exists to prevent.

## 3. One tool, not two (create-or-overwrite)

**Decision**: `create_binary_file` mirrors `create_file`'s existing semantics exactly: creates the file if the path is free, overwrites it if a file already exists there, fails with `already_exists` if a directory occupies the path. No separate `update_binary_file` tool.

**Rationale**: Confirmed by explicit Clarification-session decision. `create_file` already behaves this way for text and no workflow-breaking need for a separate "must already exist" variant was identified for binary content — an agent uploading a binary file essentially never needs to *assert* the file didn't already exist, unlike text notes where accidental overwrite of hand-authored content is a bigger concern.

**Alternatives considered**: A symmetric `create_binary_file`/`update_binary_file` pair matching the text tools — presented as an explicit option during clarification and not chosen.

## 4. `read_file`'s binary guard: extract, don't duplicate

**Decision**: The binary-detection logic currently living entirely inside `app/api/file/route.ts` (spec 003/018/028: an extension list plus a content-sniffing fallback that decodes and checks for the U+FFFD replacement character) is extracted into a new shared module, `lib/storage/binaryDetection.ts`, exporting the extension check and the content-sniffing check as plain functions. Both `app/api/file/route.ts`'s `GET` handler and the MCP `read_file` handler (`lib/mcp-tools/index.ts`) import from it.

**Rationale**: Clarification decided `read_file` must now reject binary files with a clear error instead of silently corrupting them (FR-010) — exactly the guard `GET /api/file` already has. Reimplementing that guard a second time inside the MCP tool would create two independently-maintained copies of "what counts as binary," which could drift (e.g., one gets `.docx` added to its extension list and the other doesn't) in a way that's easy to miss since nothing would fail to compile. Extracting once and importing twice makes drift structurally impossible.

**Alternatives considered**: Leaving the web route's check where it is and writing a second, MCP-specific check — rejected for the drift risk above. Making the MCP tools call the web route internally via HTTP — rejected as unnecessary indirection; both are server-side code in the same process, a plain function import is simpler and avoids a self-referential HTTP round trip.

## 5. `read_binary_file` response shape

**Decision**: `read_binary_file` returns the same envelope every existing tool already uses — `ok(data)`, which JSON-`stringify`s `data` into a single MCP `text` content block (`lib/mcp-tools/result.ts`) — with `data.content` being the base64-encoded string (`buffer.toString("base64")`) rather than the MCP protocol's native `image`/`resource` content-block types (which support a `data`/`blob` field plus `mimeType` directly).

**Rationale**: Every tool in this codebase — `create_file`, `read_file`, `create_directory`, `get_inbox`, etc. — already returns its result through the same `ok()`/`errorResult()` JSON-in-text-block envelope, regardless of what the MCP spec's content-block union technically supports. Consistency with that established, uniform convention matters more here than adopting a more "protocol-idiomatic" shape for just these two tools — a calling agent already knows to parse every tool's result as JSON text; introducing a different content-block type for exactly one tool would be a special case with no corresponding benefit inside this codebase's own conventions.

**Alternatives considered**: MCP's native `ImageContentSchema`/`EmbeddedResourceSchema` (`data`/`blob` + `mimeType` fields, no JSON-stringify wrapper) — a real, spec-compliant option, and arguably more idiomatic MCP — but rejected for inconsistency with every other tool this server exposes.

## 6. `lib/mcp-tools/catalog.ts` and `/tools` status page

**Decision**: Add `create_binary_file` and `read_binary_file` to `TOOL_CATALOG` (`lib/mcp-tools/catalog.ts`), group `"File & Directory"` — the same group `create_file`/`read_file`/etc. already use.

**Rationale**: The catalog's own doc comment states it "must be kept in sync by hand with the register*Tools calls" — skipping this would leave both new tools functional but invisible on the `/tools` status page and un-disable-able through its toggle mechanism (spec 023/024), a real functional gap, not just a documentation nicety.

**Alternatives considered**: None — this is a required, mechanical step with no reasonable alternative given the existing architecture.

**Note**: `specs/023-mcp-tool-toggle/contracts/mcp-tool-toggle-config.md`'s tool table is *not* updated by this feature. Checking this repo's history shows no later spec (017, 020, 022) went back to amend that table after adding its own new tools to `catalog.ts` — it appears to be treated as a snapshot of spec 023's original scope, not a living document that every subsequent tool-adding feature maintains. This feature follows that same precedent rather than establishing a new one unilaterally.

## 7. `next.config.ts`'s body-size cap must be raised

**Decision**: Raise `experimental.proxyClientMaxBodySize` (currently `"30mb"`, set by spec 028 to fix an analogous truncation bug on the browser upload) to `"40mb"`.

**Rationale**: Base64 inflates size by a factor of 4/3 (`ceil(n/3)*4`). A 25 MB (26,214,400-byte) file becomes ≈34.95 MB of base64 text — already over the current 30 MB cap — before accounting for the surrounding JSON-RPC tool-call envelope (path, tool name, protocol framing; a few KB, negligible next to 35 MB but not zero). `/mcp` is not excluded from the app's `middleware.ts` matcher (`/((?!_next/static|_next/image|favicon.ico).*)`), so it passes through the same proxy layer spec 028's fix already targets — meaning without raising the cap further, an MCP client uploading a file anywhere in the upper half of the allowed 25 MB range would hit the exact silent-truncation failure mode spec 028's `quickstart.md` walkthrough already caught and fixed once for the browser path. 40 MB leaves comfortable headroom (≈5 MB) above the ≈35 MB worst case.

**Alternatives considered**: Leaving the cap at 30 MB and instead lowering this feature's own effective size limit to whatever survives base64 inflation under 30 MB (≈22 MB raw) — rejected because it would silently make the MCP upload path's real limit *lower* than the browser's 25 MB, directly contradicting the Clarification-session decision that the two paths enforce identical limits.
