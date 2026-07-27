# Contract: MCP Resource Surface (new)

**Input**: [spec.md](../spec.md), [data-model.md](../data-model.md), [research.md](../research.md)

This extends `002-s3-mcp-server/contracts/mcp-tools.md`'s tool surface with MCP **resources** — read-only, code-bundled content, never backed by a bucket path (research.md §1). Registered via the SDK's `registerResource(name, uri, config, readCallback)` on the same `McpServer` instance `frontend/lib/mcp-tools/index.ts`'s `registerTools()` already configures (`frontend/app/mcp/route.ts`).

None of these resources take input parameters — each is a fixed-URI static resource, not a `ResourceTemplate`.

## Common shape

Every resource read returns a single Markdown text content block:

```
{ contents: [{ uri: "<the resource's own URI>", mimeType: "text/markdown", text: "<file content>" }] }
```

Content is read once at module load from `frontend/lib/os/engine/*.md` (research.md §3) and served verbatim — no per-request templating, no bucket access.

## `engine` (URI: `os-engine://engine`)

Source: `frontend/lib/os/engine/engine.md`.

- **Purpose**: how to build/repair `AGENTS.md` (Rule Zero equivalent, write semantics, the "nevers"), the current `os-engine-version`, and the `## Changelog`.
- **Consumed by**: an assistant handling "init"/"initialize"/"repair"/"start over" (routed to the `init` resource for the interview, which in turn defers to `engine` for the actual `AGENTS.md` build step — data-model.md's Relationships), and by `os-upgrade` for version comparison.
- **Satisfies**: FR-001, FR-002.

## `os-upgrade` (URI: `os-engine://os-upgrade`)

Source: `frontend/lib/os/engine/os-upgrade.md`.

- **Purpose**: instructs the assistant to compare `AGENTS.md`'s recorded `os-engine-version` (read via the existing `read_file` tool) against `engine`'s current version, and — if behind — present the summarized changelog difference in `os/language` and ask for confirmation before invoking `engine`'s rebuild instructions.
- **Consumed by**: an assistant handling an explicit "check for an OS upgrade" request (Story 2), and — per the same confirm-before-change step — a `repair` whose recorded version is behind current (Story 1, Scenario 4; FR-006a).
- **Satisfies**: FR-003, FR-004, FR-005, FR-006, FR-006a, FR-006b, FR-015.

## `init` (URI: `os-engine://init`)

Source: `frontend/lib/os/engine/init.md`.

- **Purpose**: the business-setup interview, activity-type decision table, and write instructions for `data/*`, `os/identity.md`, `os/policies/*`, domain skill files, `os/templates/*`, and `os/routing.md`. Instructs the assistant to check `data/` via the existing `list_directory` tool as the first step of every task (research.md §8) and to defer to `engine` for the actual `AGENTS.md` build/repair step.
- **Consumed by**: an assistant handling "init"/"initialize"/"setup os"/"create the structure" (the human-facing trigger words, research.md §2), or self-triggering when `data/` is found missing (FR-012, FR-012a).
- **Satisfies**: FR-007, FR-008, FR-009, FR-010, FR-011, FR-012, FR-012a, FR-013, FR-014, FR-015.

## Discoverability

`list_directory`/`read_file`/`create_file`/etc. never expose these three — they exist only in the MCP resource list a client can query separately (`resources/list`), matching SC-003 ("no engine rules text is ever discoverable as an editable file inside any Company OS bucket").
