# Data Model: Company OS Init Page

**Input**: [spec.md](spec.md) Key Entities, [research.md](research.md)

All entities below are plain objects/files under the app's already-configured storage bucket (spec 001/002/007) — this feature introduces no new storage mechanism, only new content at new paths.

## Company OS structure (marker state, not a record)

The pair of top-level directory markers whose joint presence/absence drives `/init`'s three states (research.md §3). Not a record with fields — its "value" is which of the two keys exist.

| Path | Kind | Notes |
|---|---|---|
| `os/` | directory marker (zero-byte object, per `createDirectory`) | Holds the system's self-description and operating guidance. |
| `data/` | directory marker | Reserved for the business's own content going forward; untouched by this feature beyond creating the marker. |

**Validation rule**: Both must exist, or neither — see research.md §3's partial-state table (FR-013).

**2026-07-25 revision**: this feature no longer creates `os/identity.md` or any other business-specific file (spec.md FR-007, removed). That's now entirely the connected AI assistant's responsibility, driven by its own interview — see `os/skills/init.md` below.

## Agents entry point (`AGENTS.md`, bucket root)

Fixed content (research.md §5) — no input of any kind, since there is no form anymore. States that any connecting AI assistant should read `os/skills/init.md` for guidance on operating the system (FR-008).

## Init skill (`os/skills/init.md`)

Fixed content (research.md §5), identical for every newly initialized Company OS — orients a connecting AI assistant on how to start operating a freshly created Company OS. This app treats its content as opaque: it doesn't parse, validate, or know what the skill does once an assistant reads it — in this project's actual skill content, that includes running its own interview and writing `os/identity.md` and other business-specific files itself (FR-009).

## MCP-connection guidance (`McpConnectManual`, not persisted)

Not a stored entity — a view rendered once `os/` and `data/` exist (research.md §6), whether freshly created or already there.

| Field | Type | Notes |
|---|---|---|
| MCP server URL | derived string | Built from the request's `host`/`x-forwarded-proto` headers, e.g. `https://your-app.vercel.app/mcp` or `http://localhost:3000/mcp`. |
| `justCreated` | boolean | Whether `?created=1` is present (i.e. this render immediately follows a confirmation, research.md §6) — adds one extra confirmation sentence, otherwise identical content. |

## Setup template (ephemeral, client-side only)

Not a persisted record — included here because it's a first-class data shape the feature produces, even though it never reaches storage or the server (research.md §7).

| Field | Type | Notes |
|---|---|---|
| Endpoint / Region / Access key ID / Secret access key / Bucket / Path-style flag | string (component state) | The six S3 connection values the visitor types into `EnvSetupHelper.tsx`; held only in browser memory. |
| Owner username / Owner password | string (component state) | The owner sign-in credential (spec 008) values, held the same way. |
| System name | string (component state), optional | Maps to `OS_NAME` (spec 003's branding var) — omitted from the generated snippet if left blank. |
| Configuration snippet | derived string | One `NAME=value` line per non-blank field above, matching `frontend/.env.example`'s exact variable names — valid both as a `.env.local` file and for pasting into a hosting provider's environment-variables UI (same format, no separate rendering). |

**Validation rules**: none enforced — the helper does not know whether the entered values are correct (it never contacts the endpoint); the visitor finds out by applying the snippet and reloading `/init` (research.md §7, US2 scenario 3).

**Lifecycle**: created and discarded entirely within one page view — never persisted, never sent in a request, gone on navigation/reload (FR-015).

## Relationships

```
bucket root
├── AGENTS.md          → references os/skills/init.md
├── os/
│   └── skills/
│       └── init.md     ← fixed template; everything else under os/ (e.g. identity.md)
│                          is created later by a connected AI assistant, not this feature
└── data/               (empty at creation time)
```

No relational/foreign-key structure beyond this fixed layout — the "record" this feature manages is the presence of this exact set of paths, checked structurally (research.md §3), not through an index or separate metadata record.
