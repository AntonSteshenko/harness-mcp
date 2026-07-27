# Contract: MCP Engine Tool Surface (new)

**Input**: [spec.md](../spec.md), [data-model.md](../data-model.md), [research.md](../research.md)

This extends `002-s3-mcp-server/contracts/mcp-tools.md`'s tool surface with three read-only, zero-argument tools that return code-bundled content, never backed by a bucket path (research.md §1). Registered via the SDK's `registerTool(name, config, handler)` in `frontend/lib/mcp-tools/engineTools.ts`'s `registerEngineTools(server)`, called alongside the existing `registerTools(server)` in `frontend/app/mcp/route.ts`.

**Revision note**: this contract originally specified three MCP *resources*. Live testing after the first deployment showed a connected assistant has no visibility into MCP resources at all — it never attempted to read them, and treated an unrelated, separately-connected MCP server as a guess for what `AGENTS.md`'s pointer meant (research.md §1). Resources were replaced with tools, which the same assistant already used successfully (`list_directory`, `read_file`) without any discovery problem.

## Common shape

Every one of these three tools takes no input and returns a single plain-text content block — **not** JSON-wrapped via the existing `ok()` helper (`frontend/lib/mcp-tools/result.ts`), since that would escape newlines and hurt readability for prose meant to be read directly, unlike the structured metadata every file-mutation tool returns:

```
{ content: [{ type: "text", text: "<file content>" }] }
```

Content is read once at module load from `frontend/lib/os/engine/*.md` (research.md §3) and served verbatim — no per-request templating, no bucket access.

## `get_os_engine`

Source: `frontend/lib/os/engine/engine.md`.

- **Purpose**: how to build/repair `AGENTS.md` (Rule Zero equivalent, write semantics, the "nevers"), the current `os-engine-version`, and the `## Changelog`.
- **Called by**: an assistant handling "init"/"initialize"/"repair"/"start over" (via `get_os_init`, whose own instructions call this tool for the actual `AGENTS.md` build step — data-model.md's Relationships), and by `get_os_upgrade` for version comparison.
- **Satisfies**: FR-001, FR-002.

## `get_os_upgrade`

Source: `frontend/lib/os/engine/os-upgrade.md`.

- **Purpose**: instructs the assistant to compare `AGENTS.md`'s recorded `os-engine-version` (read via the existing `read_file` tool) against `get_os_engine`'s current version, and — if behind — present the summarized changelog difference in `os/language` and ask for confirmation before following `get_os_engine`'s rebuild instructions.
- **Called by**: an assistant handling an explicit "check for an OS upgrade" request (Story 2), and — per the same confirm-before-change step — a `repair` whose recorded version is behind current (Story 1, Scenario 4; FR-006a).
- **Satisfies**: FR-003, FR-004, FR-005, FR-006, FR-006a, FR-006b, FR-015.

## `get_os_init`

Source: `frontend/lib/os/engine/init.md`.

- **Purpose**: the business-setup interview, activity-type decision table, and write instructions for `data/*`, `os/identity.md`, `os/policies/*`, domain skill files, `os/templates/*`, and `os/routing.md`. Instructs the assistant to check `data/` via the existing `list_directory` tool as the first step of every task (research.md §8), and to call `get_os_engine` first if `AGENTS.md` doesn't yet carry a valid `os-engine-version` (so a fresh Company OS never ends up with a fully set-up `data/` but a still-stub `AGENTS.md`).
- **Called by**: an assistant handling "init"/"initialize"/"setup os"/"create the structure" (the human-facing trigger words, research.md §2), or self-triggering when `data/` is found missing (FR-012, FR-012a).
- **Satisfies**: FR-007, FR-008, FR-009, FR-010, FR-011, FR-012, FR-012a, FR-013, FR-014, FR-015.

## Discoverability

`list_directory`/`read_file`/`create_file`/etc. never expose these three — their content only ever exists as these tools' return values, never written to the bucket (SC-003). Unlike the original resource-based design, these three **do** appear in the same `tools/list` a client already shows for `create_file`/`read_file`/etc. — that's the point: it's the one MCP primitive proven, by the same client that failed to see resources, to be reliably surfaced.

## AGENTS.md stub wording

`contracts/init-skeleton.md`'s stub `AGENTS.md` text names `get_os_init` explicitly (not a vague "through its own MCP connection") — concreteness that the original resource-based wording lacked, and that live testing showed matters.
