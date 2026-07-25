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

## Identity file (`os/identity.md`)

| Field | Type | Notes |
|---|---|---|
| Business name | string | The first form answer ("What is your business called?"), required non-blank (FR-005). |
| Business description | string | The second form answer ("What does your business do?"), required non-blank (FR-005). |

**Content shape**: a Markdown document with the business name as a top-level heading and the description as body text — plain enough for both a human (via `/editor`) and an AI assistant (via the MCP server) to read directly; no additional structured fields are introduced by this feature.

**Validation rules**: both inputs trimmed; rejected (no file written) if either is empty after trimming (FR-005).

**Lifecycle**: written once, at initialization (FR-007). This feature does not add any update/edit path for it — once created, editing it (like any other file) goes through the existing `/editor` (spec 003).

## Agents entry point (`AGENTS.md`, bucket root)

Fixed content (research.md §5) — not derived from form input. States that any connecting AI assistant should read `os/skills/init.md` for guidance on operating the system (FR-008).

## Init skill (`os/skills/init.md`)

Fixed content (research.md §5), identical for every newly initialized Company OS — orients a connecting AI assistant on how to start operating a freshly created Company OS, including pointing it at `os/identity.md` (FR-009).

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
│   ├── identity.md     ← populated from the two form answers
│   └── skills/
│       └── init.md     ← fixed template
└── data/               (empty at creation time)
```

No relational/foreign-key structure beyond this fixed layout — the "record" this feature manages is the presence of this exact set of paths, checked structurally (research.md §3), not through an index or separate metadata record.
