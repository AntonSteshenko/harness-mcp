# Data Model: Multilingual Company OS Setup

**Input**: [spec.md](spec.md) Key Entities, [research.md](research.md)

All entities below are either plain files under the app's already-configured storage bucket (spec 001/002/007), or in-memory values derived per request — this feature introduces no database and no new storage mechanism beyond one new marker file and a split template directory.

## Supported Language (static, code-defined)

Not stored anywhere — a fixed list shipped with the app (`lib/i18n/languages.ts`, research.md §1).

| Field | Type | Notes |
|---|---|---|
| `code` | one of `"en" \| "it" \| "ru" \| "fr" \| "de" \| "es"` | Canonical identifier, used in `os/language`, the `lang` form field, and every dictionary key lookup. |
| `nativeName` | string | Shown in the language picker (e.g. "Italiano"), so a visitor recognizes their own language before anything is translated. |
| `englishName` | string | Used in English-language contexts (e.g. the legacy-OS English fallback, developer-facing logs). |

**Validation rule**: Exactly six entries exist; any code read from storage or form input that doesn't match one of them is treated as invalid (falls back to `"en"` for detection, or is rejected with a 400 for the submit route, research.md §5).

## System Language (`os/language`, one per Company OS)

The single, permanent language recorded once per Company OS (spec.md Key Entities). A plain-text file, not a record with multiple fields.

| Path | Kind | Notes |
|---|---|---|
| `os/language` | file, content = one `Supported Language.code` (e.g. `it`), no trailing structure | Written once by `initializeCompanyOs(language)`, alongside `os/`, `data/`, `AGENTS.md`, `os/skills/init.md` (research.md §3). Never rewritten afterward (FR-007 — no switcher). |

**Validation rule**: On read (`getSystemLanguage()`), content is trimmed and checked against the six codes; anything else (missing file, empty, unrecognized code) is treated as "no stored language" (`null`), which `resolveLanguage()` maps to the fixed English fallback for an already-initialized Company OS (FR-013) — never an error.

**Lifecycle**: Created exactly once, together with the rest of the skeleton, inside the same `initializeCompanyOs()` call that already re-checks `checkOsStatus()` before writing anything (spec 014 research.md §4) — so a second, concurrent confirmation attempt is a no-op for `os/language` exactly as it already is for `os/`/`data/`/`AGENTS.md`/`os/skills/init.md`. Immutable for the rest of that Company OS's life.

## Localized skeleton templates (`lib/os/templates/<code>/{AGENTS.md,init.md}`)

Fixed content per language (research.md §4) — six variants of what spec 014 introduced as a single pair. This app treats each `init.md` as opaque, as before: it doesn't parse or validate what the skill instructs, only writes it verbatim.

| Field | Type | Notes |
|---|---|---|
| `code` | `Supported Language.code` | Selects which of the six subfolders `initializeCompanyOs(language)` reads. |
| `AGENTS.md` content | fixed string | Same meaning as spec 014's single template, translated; still references `os/skills/init.md` by its fixed (untranslated) path. |
| `init.md` content | fixed string | Same "Fase 1-4" skill structure as the current Italian version, translated, with every file/folder name it prescribes normalized to the shared fixed-English set (research.md §4's rename table) — identical across all six variants. |

**Validation rule**: The set of file/folder names referenced inside every language's `init.md` must be identical to the English variant's (SC-004) — enforced by authoring discipline (a single canonical "shape," research.md §4), not by runtime code, since these files are opaque, fixed content.

## UI Dictionary (`lib/i18n/dictionaries/<code>.ts`, one per language)

Not a stored entity — an in-memory string table, one module per language, sharing the same key set.

| Field | Type | Notes |
|---|---|---|
| key | string | A stable identifier for one piece of UI text (e.g. a button label, an error message) — same key exists in all six dictionary modules. |
| value | string | The text for that key, in that dictionary's language. |

**Validation rule**: None enforced at runtime (this is source code, not user data) — completeness across the six dictionaries (no missing keys) is a code-review/build-time concern, not a stored invariant.

**Lifecycle**: Selected once per request by `resolveLanguage()` (research.md §7); passed down from each top-level `page.tsx`/`layout.tsx` to the client components that render translated text, the same way `app/init/page.tsx` already passes `mcpUrl` to `McpConnectManual` (spec 014).

## Relationships

```
bucket root
├── AGENTS.md          → one of six fixed, localized variants; still references os/skills/init.md
├── os/
│   ├── language        ← NEW: the two-letter code fixing this Company OS's language forever
│   └── skills/
│       └── init.md     ← one of six fixed, localized variants; everything it prescribes uses the
│                          same fixed English file/folder names in every language (research.md §4)
└── data/               (empty at creation time, as in spec 014)

lib/i18n/
├── languages.ts         (the six Supported Language entries, source of truth for codes/names)
├── dictionaries/*.ts    (one UI string table per code, keyed the same across all six)
└── resolve.ts           (per-request: os/language present? → use it; absent + OS exists? → "en";
                           OS doesn't exist yet? → live Accept-Language detection)
```

No relational/foreign-key structure — `os/language`'s "record" is a single file's content, checked structurally (present/absent, valid/invalid code) exactly the way `os/`/`data/`'s presence already drives `checkOsStatus()` (spec 014).
