# Contract: `initializeCompanyOs` (revised)

**Input**: [spec.md](../spec.md), [data-model.md](../data-model.md), [research.md](../research.md) §7

Extends `015-multilingual-support/contracts/language-resolution.md`'s `initializeCompanyOs(language: SupportedLanguage): Promise<{ created: boolean }>` contract. Signature is unchanged; what it writes changes.

## `initializeCompanyOs(language: SupportedLanguage): Promise<{ created: boolean }>`

Re-checks `checkOsStatus()` first, exactly as before (spec 014 research.md §4, spec 015 FR-011); any status other than `"empty"` → no-op, `{ created: false }`.

If `"empty"`, creates — in order:

| Step | Before this feature | After this feature |
|---|---|---|
| `os/` | created | created (unchanged) |
| `data/` | created | created (unchanged) |
| `AGENTS.md` | **already a stub today** — 4 lines, "read `os/skills/init.md` first" (`lib/os/templates/<language>/AGENTS.md`); the *full* router only appears later, once a connected assistant runs `os/skills/init.md`'s own Phase 3 and overwrites it | **stub, reworded** — same file, same size, but names the `get_os_init` MCP tool by name instead of a bucket path (no `os/skills/init.md` to point at anymore); still carries no `os-engine-version` (version `0`) until `get_os_engine`'s instructions do the real build |
| `os/skills/init.md` | written — full copy of the per-language engine+interview file (`lib/os/templates/<language>/init.md`) | **not written** — file and its six per-language sources are removed; its content now lives once, in English, as the `get_os_init`/`get_os_engine` MCP tools (research.md §7) |
| `os/language` | written | written (unchanged, spec 015) |

## Stub `AGENTS.md` content contract

**The size and role of this file at `/init`-submission time do not change** — it was already a minimal pointer stub, not the full router, before this feature. What changes is *what it points at*. Must, in the confirmed `language`:

- State that this bucket hosts a Company OS.
- Name the `get_os_init` MCP tool explicitly, instructing whatever assistant connects next to call it to build the real router — not to read a bucket file (contrast with today's "read `os/skills/init.md` first", which stops being valid once that file is no longer written). Naming the tool concretely, rather than gesturing at "its MCP connection" in the abstract, matters in practice — see research.md §1's post-launch correction.
- Carry no `os-engine-version` front matter (its absence is what marks this Company OS as not yet built by `get_os_engine` — FR-007, data-model.md's AGENTS.md Lifecycle).

## Unaffected by this feature

- `checkOsStatus()` — same three-state (`empty`/`already_initialized`/`partial`) semantics, same `hasAnyObjectWithPrefix("os/")`/`hasAnyObjectWithPrefix("data/")` check.
- The `/init` page's UI flow, language confirmation (spec 015), and double-submit protection.
