# Contract: `/init` page and submit route (extends spec 014's `contracts/init-page.md`)

Only the empty-bucket ("no `os/`, no `data/`") row of spec 014's state table changes. Every other row (storage not connected, already initialized, partial state, sign-in gate) is unchanged in *routing* behavior — the only difference is that all four now render in the language `resolveLanguage()` returns (contracts/language-resolution.md) instead of hardcoded English strings.

## `GET /init` — empty-bucket state (was: single no-field confirmation)

| Step | Behavior |
|---|---|
| 1 | Server resolves the detected language via `detectBrowserLanguage(headers().get("accept-language"))` (FR-002, FR-014 — live, not yet persisted, since no Company OS exists yet). |
| 2 | Page renders `LanguageConfirm`, passing the detected code: shows all six languages (native names), the detected one pre-selected, and the same explanation text as spec 014 ("This creates the starting structure…"). |
| 3 | The existing `<form method="POST" action="/init/submit">` gains one field carrying the currently-selected code (`lang`); the visitor can change the selection before submitting (FR-004). |
| 4 | No storage write of any kind happens before submission (FR-005) — identical to spec 014's "no OS content until confirmed" rule, now extended to cover the language choice too. |

## `GET /init` — every other state

Unchanged routing/branching from spec 014's table (storage-not-connected → `EnvSetupHelper`; signed-out → redirect to `/oauth/login`; already-initialized → `McpConnectManual`; partial → the distinct "unexpected state" message). Text on all of them now comes from `resolveLanguage()`'s dictionary (contracts/language-resolution.md) instead of a hardcoded literal:
- `EnvSetupHelper` and the empty-bucket explanation: live browser detection (FR-014, no Company OS/`os/language` exists yet).
- `McpConnectManual` and the "partial state" message: the Company OS's stored `os/language` if set, else English (FR-008/FR-013).

## `POST /init/submit`

Extends spec 014's contract with the new `lang` field — see `contracts/language-resolution.md`'s dedicated section for the full behavior table. Everything else (auth requirement, no-op on already-initialized, `303` redirect to `/init?created=1`) is unchanged from spec 014.

## Other routes

`/editor`, `/settings/*`, `/oauth/authorize`, `/oauth/login` (the human-facing pages) now render via `resolveLanguage()`'s dictionary instead of hardcoded English. `/oauth/token`, `/oauth/register`, `/oauth/revoke`, `/.well-known/*`, and `/mcp` are functionally and textually unchanged — these are machine-facing protocol routes, explicitly out of scope (research.md §8).
