# Contract: Language resolution (`lib/i18n/*`)

## `detectBrowserLanguage(acceptLanguageHeader: string | null): SupportedLanguage`

| Input | Output |
|---|---|
| `null` / empty string | `"en"` |
| Header with no subtag matching one of the six supported codes (e.g. `pt-BR,pt;q=0.9`) | `"en"` |
| Header with a matching subtag, possibly among others, in any position (e.g. `fr-CA,en;q=0.8` or `en-US,fr;q=0.9`) | The first matching code in the header's own preference order (`"fr"` and `"en"` respectively for the two examples) |
| Regional subtag on a supported language (e.g. `it-IT`, `de-CH`) | The base code (`"it"`, `"de"`) |

Pure function — no I/O, no storage access.

## `getSystemLanguage(): Promise<SupportedLanguage | null>`

| `os/language` state | Result |
|---|---|
| Does not exist (Company OS doesn't exist yet, or predates this feature) | `null` |
| Exists, content trims to one of the six codes | That code |
| Exists, content is empty/unrecognized (corrupted or hand-edited) | `null` — treated the same as "not set," never an error |

## `resolveLanguage(): Promise<SupportedLanguage>`

The single per-request entry point every page/layout calls. Wrapped in React `cache()` — at most one `checkOsStatus()` and one `getSystemLanguage()`/header-read pair per request, regardless of how many components call it.

| `checkOsStatus()` | `getSystemLanguage()` | Result | Spec rule |
|---|---|---|---|
| `"empty"` or `"partial"` (no Company OS with a language yet) | *(not called)* | `detectBrowserLanguage(headers().get("accept-language"))` | FR-014 — live, per-request, not persisted |
| `"already_initialized"` | returns a code | that code | FR-008 — the confirmed, permanent language |
| `"already_initialized"` | returns `null` (pre-feature install) | `"en"` | FR-013 — fixed fallback, no detection, no asking |

## `POST /init/submit` — new `lang` field (extends contracts/init-page.md)

| Condition | Behavior |
|---|---|
| `lang` form field present and matches one of the six codes | Passed to `initializeCompanyOs(lang)` (below). |
| `lang` missing or not one of the six codes | `400` JSON error (`{ "error": "invalid_language" }`) — only reachable via a malformed direct request; the UI (`LanguageConfirm.tsx`) always sends a valid value. |
| Company OS already exists (`os/`/`data/` present) by the time the handler runs | No-op, same as spec 014's existing double-submit protection — `lang` is ignored, no `os/language` write, `303` to `/init?created=1` as before. |

## `initializeCompanyOs(language: SupportedLanguage): Promise<{ created: boolean }>`

Extends spec 014's contract (which took no arguments). Re-checks `checkOsStatus()` first exactly as before; if `"empty"`, creates — in order — `os/`, `data/`, `AGENTS.md` (from `lib/os/templates/<language>/AGENTS.md`), `os/skills/init.md` (from `lib/os/templates/<language>/init.md`), and `os/language` (content: `language`). Any other status → no-op, `{ created: false }`, exactly as spec 014 defines.
