# Data Model: Split the OS Engine From Business Bootstrap

**Input**: [spec.md](spec.md) Key Entities, [research.md](research.md)

All entities below are either plain files under the app's already-configured storage bucket (spec 001/002/007), or MCP resources served from code-bundled Markdown source (not stored in the bucket at all) — this feature introduces no database and no new storage mechanism.

## Engine resource (`frontend/lib/os/engine/engine.md`, MCP resource `engine`)

Code-bundled, English-only, never written to the bucket (FR-001, research.md §1/§3).

| Field | Type | Notes |
|---|---|---|
| `os-engine-version` | positive integer, YAML front matter | The current version an owner's `AGENTS.md` is compared against (research.md §4). Bumped by a code change (a PR), never at runtime. |
| body | Markdown | Rule Zero equivalent (how to build/repair `AGENTS.md` safely), write-semantics rules, the "nevers" — the mechanics-only subset of today's `en/init.md`. |
| `## Changelog` | Markdown, one `### vN` subsection per version | Source for the "net difference" summary (FR-004) — the assistant reads every subsection whose `N` is greater than `AGENTS.md`'s recorded version and presents their union as one flat list, not organized by version (research.md §4, spec Clarifications). |

**Validation rule**: `os-engine-version` in this file only ever increases across commits — enforced by authoring discipline (code review), not runtime code, same as spec 015's cross-language file/skill-name consistency rule.

## Os-upgrade resource (`frontend/lib/os/engine/os-upgrade.md`, MCP resource `os-upgrade`)

Code-bundled, English-only, never written to the bucket.

| Field | Type | Notes |
|---|---|---|
| body | Markdown | Instructs the assistant: read `AGENTS.md`'s recorded version, read `engine`'s current version + changelog, compare, and — if behind — translate the changelog summary into `os/language` (FR-015) and ask for confirmation before rebuilding (FR-003, FR-004, FR-005, FR-006). Also the resource a `repair` (Story 1, Scenario 4) reaches for when it needs the same confirm-before-change step (FR-006a/FR-006b). |

## Init / business-setup resource (`frontend/lib/os/engine/init.md`, MCP resource `init`)

Code-bundled, English-only, never written to the bucket. Successor to today's `en/init.md` Phases 1–3 (interview, activity-type decision table, writes), minus the mechanics that moved to `engine.md`.

| Field | Type | Notes |
|---|---|---|
| body | Markdown | The interview questions (company info, activity type, who's involved, tone, pricing/product as applicable, out-of-scope), the activity-type → `data/`-subdirs/domain-skills decision table, and the write instructions for `os/identity.md`, `os/policies/*`, domain skill files, `os/templates/*`, `data/*`, and `os/routing.md`. Instructs the assistant to check for missing business data via `list_directory "data/"` as its first step on every task (FR-012, FR-012a, research.md §8), and to write/report everything in `os/language` (FR-015). |

## AGENTS.md (bucket file, one per Company OS)

Unchanged path, extended shape.

| Field | Type | Notes |
|---|---|---|
| `os-engine-version` | positive integer, YAML front matter — **new**, optional | Absent = version `0` (FR-002, FR-007) — every pre-this-feature Company OS starts here. Written/updated only by the `engine` resource's build/repair flow. |
| body | Markdown, in `os/language` | Router content, built by the connected assistant per the `engine` resource. No longer includes an inline routing table (moves to `os/routing.md`, FR-009) — replaces the "routing table with only the created skills" section today's `en/init.md` Phase 3 describes with a pointer to `os/routing.md`. |

**Lifecycle**: a fresh Company OS gets a *stub* `AGENTS.md` (no `os-engine-version` field) written by `frontend/lib/os/init.ts`'s `initializeCompanyOs()` at `/init`-confirmation time (research.md §7) — its only job is telling the next connected assistant to build the real one via the `engine` resource. The assistant's first real build (Story 1, Scenario 1) is what actually sets `os-engine-version` for the first time.

## Routing file (`os/routing.md`, bucket file, one per Company OS — new)

| Field | Type | Notes |
|---|---|---|
| body | Markdown table: task/skill description → skill file path | Created and kept up to date by the `init` (business-setup) resource's flow (FR-009); editable independently of any `AGENTS.md` repair/upgrade (FR-014, SC-004). Lives under `os/`, not `data/` (FR-010) — trusted OS control content, same trust class as `os/skills/*.md`, not business records. |

**Lifecycle for pre-existing (v0) Company OS instances**: the first repair/upgrade an owner requests extracts whatever routing table is embedded in the old `AGENTS.md`'s text into this file before `AGENTS.md` is rebuilt (FR-008, Story 3) — a one-time, assistant-performed copy, not a recurring migration step (research.md §5).

## Per-language skeleton templates (`frontend/lib/os/templates/<code>/AGENTS.md`, six files — reduced scope)

| Field | Type | Notes |
|---|---|---|
| content | fixed string per language | Already this same minimal stub shape today (spec 015) — only the pointer wording changes, from "read `os/skills/init.md` first" to pointing at the assistant's MCP connection, since that bucket file no longer exists (research.md §7). |

**Removed**: `frontend/lib/os/templates/<code>/init.md` (all six) — superseded by the single English `init` resource (research.md §3, §7).

## Relationships

```
MCP server (code, never in the bucket)
├── resource "engine"      → builds/repairs → AGENTS.md (bucket)
├── resource "os-upgrade"  → reads AGENTS.md + "engine", writes AGENTS.md (bucket, on confirmation)
└── resource "init"        → reads AGENTS.md + os/language, writes → data/*, os/identity.md,
                              os/policies/*, os/skills/*.md (domain skills), os/templates/*,
                              os/routing.md (bucket)

bucket root
├── AGENTS.md          → stub (from /init) or fully built (from the "engine" resource);
│                         records os-engine-version; points to os/routing.md, not an inline table
├── os/language        → unchanged (spec 015), read by "os-upgrade"/"init" for FR-015 translation
├── os/routing.md       → NEW, written by "init", read/updated independently afterward
├── os/identity.md, os/policies/*, os/skills/*.md, os/templates/*   → unchanged shape, now written
│                         by the "init" resource's flow instead of by en/init.md's Phase 3
└── data/*              → unchanged shape, written by the "init" resource's flow
```
