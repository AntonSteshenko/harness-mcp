# Contract: `GET /api/file` and client-side `kind` derivation

This feature adds no new API routes and changes no server-side response shape. It only adds a new client-side rendering branch. Documented here (per project convention, see `specs/009-editor-login-gate/contracts/protected-routes.md`) so the "unchanged" surface is explicit.

## `GET /api/file?path=...`

| Aspect | Behavior |
|---|---|
| Request | Unchanged from specs 003/004/005/007/008/009. |
| Response (success) | Unchanged: `{ "content": string }` — raw file text, regardless of extension. A `.csv` file's response is identical in shape to a `.md` or `.txt` file's. |
| Response (unsupported binary) | Unchanged: `422 { "message": string }` (spec 003's `BINARY_EXTENSIONS`/decode-failure check). `.csv` is not in `BINARY_EXTENSIONS` and decodes as UTF-8 text, so it is never rejected here — same as today. |
| Response (error) | Unchanged. |

**Guarantee**: The API layer has no concept of "CSV" — it treats `.csv` files exactly as it treats any other text file today. All CSV-specific behavior (parsing, table rendering, the 5,000-row cap) is client-side only, applied after the existing fetch succeeds.

## `PUT /api/file` (save)

Unchanged. Because the table view is read-only (FR-007) and edits happen only through the existing raw-text view, saving a `.csv` file goes through the exact same `PUT /api/file` call with the same `{ path, content }` body as any other file kind (spec 003) — no new save path, no new request/response shape.

## Client-side contract: `EditorSession.kind`

Not a network contract, but the one public "interface" this feature changes for other client code reading `FileEditor.tsx`:

| Before | After |
|---|---|
| `kind: "markdown" \| "text"` | `kind: "markdown" \| "text" \| "csv"` |

Any code branching on `session.kind` (currently only `FileEditor.tsx` itself) must handle the new `"csv"` value; the existing `"text"` fallback in `deriveKind()` no longer applies to `.csv` files once this feature ships (a `.csv` file now derives `kind: "csv"` instead of falling through to `"text"`/`PlainTextEditor`).

## Unaffected routes

`/api/tree`, `/api/directory`, `/api/upload`, `/api/download-zip`, `/mcp` (all MCP tools), and all `/oauth/*` / `/.well-known/*` routes are untouched by this feature.
