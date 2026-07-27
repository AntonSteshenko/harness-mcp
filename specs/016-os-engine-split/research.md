# Research: Split the OS Engine From Business Bootstrap

**Input**: [spec.md](spec.md) (Clarifications, Assumptions), existing codebase (`frontend/lib/os/init.ts`, `frontend/lib/os/templates/en/*`, `frontend/lib/mcp-tools/*`, `frontend/app/mcp/route.ts`, specs 010/014/015)

## §1 — How are the three "MCP-only, not-in-bucket" things actually exposed?

**Superseded by live testing, post-launch** — see the correction below. Kept for the record of what was tried and why it didn't hold up.

**Original decision (reverted)**: MCP **resources** (`server.registerResource(name, uri, config, readCallback)`), not tools. `frontend/app/mcp/route.ts` builds its server via `mcp-handler`'s `createMcpHandler((server) => registerTools(server), ...)`, and that `server` is the SDK's real `McpServer` (confirmed present: `node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.d.ts` exports `registerResource` alongside `registerTool`). Resources looked like the SDK's primitive for exactly this shape — read-only, server-provided content a client can list and fetch, independent of the bucket's file tree — so `list_directory`/`read_file` would never surface them (Story 1, Scenario 3; SC-003). Rejected at the time: a tool-based alternative (`get_engine_rules()`), for mixing "fetch some instructions" into the same namespace as the file-mutation tools (`create_file`, `update_file`, ...); and MCP prompts, as user-invoked slash-command-like templates with arguments, a worse fit than something read once as background instructions.

**Correction — resources are not reliably discoverable across MCP clients**: the first live session through a real connected assistant (post-launch) showed the assistant successfully calling `list_directory`/`read_file` (ordinary tools) but having **no visibility at all** into the registered resources — it didn't know `engine`/`os-upgrade`/`init` existed, and instead guessed that a completely unrelated, separately-connected MCP server with a similar-sounding name might be the "engine" `AGENTS.md`'s stub vaguely pointed at. This matches a known, real gap in MCP client support: `tools/list`+`tools/call` are close to universally wired up by MCP host applications, while `resources/list`+`resources/read` support is inconsistent, especially in consumer-facing products — exactly the kind of assumption `quickstart.md`'s live scenarios (never run in the original implementation environment) would have caught.

**Revised decision**: MCP **tools**, zero-argument, one per file — `get_os_engine`, `get_os_upgrade`, `get_os_init` (`frontend/lib/mcp-tools/engineTools.ts`, `registerEngineTools(server)`, alongside the existing `registerTools(server)` in `frontend/app/mcp/route.ts`). Each returns its Markdown file's content as a single plain-text content block (not JSON-wrapped via the existing `ok()` helper — that would escape newlines and hurt readability for prose meant to be read directly, unlike the structured data every other tool returns). The original namespace-mixing objection is real but minor next to reliability: the same assistant that failed to see the resources called `list_directory`/`read_file` without any trouble, so tools are what's actually proven to work.

## §2 — Tool names

**Decision**: `get_os_engine`, `get_os_upgrade`, `get_os_init`.

**Rationale**: matches the conversation's converged naming swap — the pure mechanics tool gets a neutral, internal-sounding name (`get_os_engine`) since an owner never asks for it by name (FR-001's rules are invoked automatically whenever `AGENTS.md` needs building/repairing); the human-facing trigger words an owner actually says ("init", "initialize", "setup os", "create the structure") map to the business-bootstrap tool (`get_os_init`), since that's what an owner means by them (spec's User Story 4). `get_os_upgrade` is the one tool an owner does ask for by a specific name (Story 2, FR-003), so it keeps a self-explanatory name. The `get_` prefix and `os_` namespace on all three keep them visually grouped and distinct from the file-mutation tools (`create_file`, `read_file`, ...) in a client's tool list, partially offsetting the original namespace-mixing concern from §1.

## §3 — Where does the English-only source content live?

**Decision**: `frontend/lib/os/engine/{engine.md, os-upgrade.md, init.md}`, read once at module load via `readFileSync` into constants — the same pattern `frontend/lib/os/init.ts` already uses for `SKELETON_TEMPLATES` (literal paths, so Vercel's `@vercel/nft` build-time file tracing bundles them).

**Rationale**: keeps this feature's new content in the same "plain Markdown files, not inline string constants" shape spec 015 already chose for the same reason (directly editable in a PR, no string-escaping). A separate `os/` subdirectory (distinct from `lib/os/templates/`) signals these are the MCP-only engine files, not per-language bucket templates.

**Alternatives considered**: inline TS string constants (rejected — same reasoning spec 015 rejected it for templates: harder to review/edit as prose). A single combined file for all three tools (rejected — Story 1/2/4 are independently testable/deployable; one file per tool keeps that boundary in the source tree too).

## §4 — Version representation

**Decision**: a plain positive integer (`1`, `2`, `3`, ...), monotonically increasing, stored as `os-engine-version: N` in `AGENTS.md`'s YAML front matter (new — today's `AGENTS.md` has no front matter at all). Absence of the field means version `0` (FR-007) — never an error, never a parse failure.

**Rationale**: FR-004's clarified behavior ("summarize the net difference... not a per-version history") never requires addressing an individual version in isolation — only "am I behind, and if so what changed overall" — so semantic versioning's extra structure (major/minor/patch meaning) buys nothing here. An integer is trivially comparable (`recorded < current`) and trivially "the oldest possible version" for the FR-007/Story 3 migration case (`0`, or absent, sorts before every real version).

**Alternatives considered**: semver (rejected — no consumer of this feature ever needs to reason about "is this a breaking change," only "is there a newer version"). ISO date (rejected — spec's own `updated:` front-matter convention in today's `init.md` already uses dates for a different purpose — "when was this content last touched" — reusing it for version identity would conflate the two).

## §5 — Who actually compares versions and does the migration extraction — app code or the connected assistant?

**Decision**: the **connected assistant**, reading plain text, guided by instructions inside the `get_os_engine`/`get_os_upgrade` tool output — no new backend parsing/diffing code.

**Rationale**: every actor in Stories 1-4 is "the owner asks a connected assistant" — this whole feature operates through chat over MCP, the same way `daily-plan.md`/`schedule.md` already instruct the assistant today (spec 014's `en/init.md`), not through a Next.js UI surface. The assistant already has `read_file` (sees `AGENTS.md`'s front matter and body as plain text) and the `get_os_engine`/`get_os_upgrade` tools (return the current version + changelog as plain text) — comparing two small integers and re-reading a markdown table to copy rows into `os/routing.md` (FR-008's extraction) is well within what an LLM instructed to do so reliably handles as a reading/writing task, matching how the *existing* `init.md` already asks the assistant to parse `AGENTS.md`'s current content during Rule Zero ("Past the bootstrap's fixed one-liner... does it already hold the full router?"). Writing bespoke YAML-front-matter-parsing or markdown-table-diffing code in `lib/` would be new, untested (project has no automated test suite, per spec 015's Testing section) surface area for something the assistant already does as part of its normal job.

**Alternatives considered**: a `check_os_version` MCP tool that does the comparison in code and returns a structured verdict (rejected — would need its own YAML/markdown parser with no existing dependency for it, adds a stateful contract to test/maintain, and buys nothing over the assistant reading two small tool outputs itself; revisit only if a future feature needs programmatic — not chat-driven — access to this state).

## §6 — Routing file: name, format, location

**Decision**: `os/routing.md` — a plain Markdown table (task/skill description → skill file path), living under `os/` per FR-010's trust-boundary requirement.

**Rationale**: `.md` matches every other OS control file (`os/identity.md`, `os/policies/*.md`, `os/skills/*.md`); a table is how today's single-file `AGENTS.md` already represents its inline routing table (`en/init.md`'s Phase 3: "routing table with only the created skills"), so the migration/extraction step (§5, FR-008) is a structural copy, not a reformat.

## §7 — Impact on the existing `/init` page (specs 014, 015)

**Correcting an assumption**: `frontend/lib/os/init.ts`'s own docstring and `lib/os/templates/en/AGENTS.md`'s actual content confirm `/init` **already writes only a 4-line stub** today ("This bucket hosts a Company OS... read the skill at `os/skills/init.md` first") — not a full router. The full router only exists once a connected assistant later runs `os/skills/init.md`'s own Phase 3 and overwrites `AGENTS.md`. So this feature does **not** shrink an existing full-router write down to a stub — that write was already minimal. What it removes is the **second** file `/init` writes today: the full per-language copy of `os/skills/init.md` itself.

**Decision**: `frontend/lib/os/init.ts`'s `initializeCompanyOs(language)` still does the *first* bucket-connectivity step (creates empty `os/` + `data/`, writes `os/language`, per spec 015) and still writes an `AGENTS.md` stub of essentially the same size and role as today — only its wording changes, from "read `os/skills/init.md` first" to naming the `get_os_init` MCP tool by name, since that bucket file no longer exists to point at (revised post-launch, §1 correction: a vague "through its own MCP connection" pointer wasn't concrete enough for a connected assistant to act on — naming the tool directly is). It **stops** writing `os/skills/init.md` entirely (previously a full per-language copy of the engine+interview content). `frontend/lib/os/templates/<lang>/init.md` (all six) are deleted — their content is superseded by the single English `frontend/lib/os/engine/init.md` file, exposed via the `get_os_init` tool (§3); `frontend/lib/os/templates/<lang>/AGENTS.md` (all six) keep their stub shape, reworded.

**Rationale**: Story 1, Scenario 1 frames the *real* `AGENTS.md` build (the one with a routing table, rules, and a recorded version) as something "the owner asks a connected assistant" to do — which already matches today's behavior (Phase 3 does that build, not `/init`). The only thing that has to change at `/init` time is that it can no longer copy `os/skills/init.md` into the bucket, since that content is now MCP-only (FR-001) — so the stub's pointer text has to change with it.

**Alternatives considered**: leave `/init` writing `os/skills/init.md` as today, layering the engine split only on top of *later* repairs/upgrades (rejected — directly contradicts FR-001/SC-003, which require the engine's rules to never be bucket-writable, including at first creation).

## §8 — How does the assistant know business data is missing, each task, without a dedicated status tool?

**Decision**: no dedicated status-check tool beyond the three from §1. The `get_os_init` tool's own instructions tell the assistant to check via the `list_directory` tool it already has (equivalent to today's `checkOsStatus()` semantics — "empty" means `data/` has no entries), as its first step for any task, exactly like today's Rule Zero already opens with `list_directory ""` and `list_directory "os/"`.

**Rationale**: FR-012a's cadence ("every task, as part of the normal first read") is something the existing `list_directory` tool already satisfies; adding a dedicated status tool would duplicate `checkOsStatus()`'s logic (already implemented for the web app in `frontend/lib/os/init.ts`) in a second place for no behavioral gain the assistant couldn't already get itself.

## §9 — New dependencies

**Decision**: none. No YAML/front-matter parsing library, no helper beyond what `@modelcontextprotocol/sdk` (already installed, already used for the existing file tools) provides for `registerTool`.

**Rationale**: consistent with spec 015's own research (§6 there: "no new npm dependency... fits this app's model better than a library"), and with §5 above establishing that no code-level parsing is needed at all.
