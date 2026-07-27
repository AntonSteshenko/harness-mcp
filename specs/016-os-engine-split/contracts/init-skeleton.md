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
| `AGENTS.md` | **already a stub today** — 4 lines, "read `os/skills/init.md` first" (`lib/os/templates/<language>/AGENTS.md`); the *full* router only appears later, once a connected assistant runs `os/skills/init.md`'s own Phase 3 and overwrites it | **stub, reworded** — same file, same size, but points at the assistant's MCP connection instead of a bucket path (no `os/skills/init.md` to point at anymore); still carries no `os-engine-version` (version `0`) until the `engine` resource does the real build |
| `os/skills/init.md` | written — full copy of the per-language engine+interview file (`lib/os/templates/<language>/init.md`) | **not written** — file and its six per-language sources are removed; its content now lives once, in English, as the `init`/`engine` MCP resources (research.md §7) |
| `os/language` | written | written (unchanged, spec 015) |

## Stub `AGENTS.md` content contract

**The size and role of this file at `/init`-submission time do not change** — it was already a minimal pointer stub, not the full router, before this feature. What changes is *what it points at*. Must, in the confirmed `language`:

- State that this bucket hosts a Company OS.
- Instruct whatever assistant connects next to build the real router by consulting its MCP connection — not by reading a bucket file (contrast with today's "read `os/skills/init.md` first", which stops being valid once that file is no longer written).
- Carry no `os-engine-version` front matter (its absence is what marks this Company OS as not yet built by the `engine` resource — FR-007, data-model.md's AGENTS.md Lifecycle).

## Unaffected by this feature

- `checkOsStatus()` — same three-state (`empty`/`already_initialized`/`partial`) semantics, same `hasAnyObjectWithPrefix("os/")`/`hasAnyObjectWithPrefix("data/")` check.
- The `/init` page's UI flow, language confirmation (spec 015), and double-submit protection.
