# Research: Multilingual Company OS Setup

**Input**: [spec.md](spec.md), existing `frontend/lib/storage/*`, `frontend/lib/os/init.ts`, and `frontend/app/init/*` (specs 001, 002, 007, 014).

## §1. The six supported languages and their codes

**Decision**: `SUPPORTED_LANGUAGES` is a fixed array of six ISO 639-1 codes with both a native and an English display name, used everywhere a language needs to be shown or compared:

| Code | Native name | English name |
|---|---|---|
| `en` | English | English |
| `it` | Italiano | Italian |
| `ru` | Русский | Russian |
| `fr` | Français | French |
| `de` | Deutsch | German |
| `es` | Español | Spanish |

**Rationale**: Two-letter codes are enough — the spec doesn't call for regional variants (e.g. `pt-BR` vs `pt-PT`), and none of these six languages has a product-relevant regional split. Showing the *native* name in the language picker (research.md §5) means a visitor can recognize their own language even before anything is translated.

**Alternatives considered**: BCP-47 tags with region (`en-US`, `it-IT`, …) → rejected: adds a normalization step for no benefit, since the feature only ever needs to pick one of six buckets, not render region-specific formatting.

## §2. Detecting the browser's language

**Decision**: `detectBrowserLanguage(acceptLanguageHeader: string | null): SupportedLanguage` (`lib/i18n/detect.ts`) parses the standard `Accept-Language` HTTP header (already accessible via `headers()` from `next/headers`, exactly as `frontend/app/init/page.tsx` already does for `host`/`x-forwarded-proto`) — splits it on commas, strips `;q=` weight suffixes, takes the primary language subtag before any `-` (e.g. `it-IT` → `it`), and returns the first one that matches one of the six supported codes, walking the header's own preference order. Returns `"en"` if the header is absent or none of its subtags match.

**Rationale**: `Accept-Language` is the standard, already-available signal for this — no client-side JavaScript or extra request round trip needed; it's read the same way in every server component that needs it (`/init`'s empty-bucket state, and the root layout for pre-confirmation pages). Falling back to `en` on no match satisfies FR-003 and edge case ("browser reports an unsupported language").

**Alternatives considered**: Reading `navigator.language` client-side and posting it to the server → rejected: adds a client round trip and a loading flash for something the request already carries in a header; `Accept-Language` is exactly what browsers set to `navigator.language`'s value(s) on outgoing requests already.

## §3. Persisting the confirmed language (`os/language`)

**Decision**: A new, dedicated marker file `os/language` — plain text, containing only the two-letter code (e.g. `it`) — is written once, alongside `AGENTS.md` and `os/skills/init.md`, by `initializeCompanyOs(language)`. `getSystemLanguage(): Promise<SupportedLanguage | null>` (`lib/i18n/resolve.ts`) reads it via the existing `readFile()` primitive, trims and validates the content against the six codes, and returns `null` if the file doesn't exist or its content doesn't match one of them (treated as "no stored setting," FR-013).

**Rationale**: Spec 014 established `AGENTS.md` as fixed, verbatim, product-provided content — "no substitution ever happens" (spec 014 research.md §5). Embedding a `lang:` value into `AGENTS.md`'s own front matter would break that invariant (the file would no longer be byte-identical across installs of the same language, and would need YAML parsing just to read one field). A tiny, dedicated marker file is simpler to read, write, and validate, and keeps `AGENTS.md`/`init.md` exactly as "fixed content, chosen once at write time" as before — just one of six fixed variants (research.md §4), not a templated one.

**Alternatives considered**:
- Front-matter field inside `AGENTS.md` (e.g. `lang: it`) → rejected: breaks the "verbatim, no substitution" invariant spec 014 relies on, and needs a YAML parser for a single value.
- A new top-level `data/` field or database record → rejected: `data/` is reserved for the business's own content (spec 014 data-model.md), not app configuration; there's no database in this project, only the S3-compatible bucket.

## §4. Localized skeleton templates and fixed English file/folder names

**Decision**: `frontend/lib/os/templates/` splits from a single flat pair (`AGENTS.md`, `init.md`) into six per-language subfolders — `en/`, `it/`, `ru/`, `fr/`, `de/`, `es/` — each with its own `AGENTS.md` and `init.md`. `initializeCompanyOs(language)` reads the pair matching the confirmed language and writes it verbatim (same "no substitution" pattern as spec 014), plus the `os/language` marker (research.md §3).

The current (Italian-only) `os/skills/init.md` prescribes some file/skill names that aren't in English yet: `giornata.md`, `stato-progetti.md`, `articolo.md`, `proposta-commerciale.md`, `onboarding-cliente.md`, `prodotto.md`, `comunicazione.md` (policy), and the `cliente.md` template. Since FR-011 requires every directory/file name to be the same fixed English name regardless of confirmed language, this feature renames all of them once, in the shared "shape" the skill describes, before translating the skill's prose into all six languages:

| Old (Italian) name | New fixed English name |
|---|---|
| `giornata.md` | `daily-plan.md` |
| `stato-progetti.md` | `project-status.md` |
| `articolo.md` | `article.md` |
| `proposta-commerciale.md` | `commercial-proposal.md` |
| `onboarding-cliente.md` | `client-onboarding.md` |
| `prodotto.md` | `product.md` |
| `comunicazione.md` (policy) | `communication.md` |
| `cliente.md` (template) | `client.md` |

Names already in English (`data/clients/`, `data/projects/`, `data/leads/`, `data/products/`, `data/library/`, `identity.md`, `pricing.md`, `delivery.md`, `weekly-review.md`, `lead.md`, `brief.md`, `status.md`, `log.md`) are unchanged.

**Rationale**: This is exactly what FR-011/SC-004 require — the same folder/file tree regardless of which of the six languages a Company OS confirms. Doing it once, in a single canonical "shape" shared by all six translated skill variants, is what makes SC-004 ("identical directory/file names across languages") actually true by construction rather than something each translator has to remember to preserve independently.

**Alternatives considered**: Leave the Italian names as-is for the `it/init.md` variant only, translating the *other* five languages against a *different*, all-English shape → rejected outright: this would make the Italian-confirmed Company OS structurally different from every other language's, violating FR-011/SC-004 directly.

## §5. The language-confirmation step on `/init`'s empty-bucket state

**Decision**: `LanguageConfirm.tsx` (new, `"use client"`) renders inside `/init`'s existing empty-bucket branch (`app/init/page.tsx`), receiving the server-detected language (`detectBrowserLanguage()`, research.md §2) as a prop. It shows that language pre-selected among all six (native names, research.md §1) and wraps the existing `<form method="POST" action="/init/submit">` — the only change to that form is a hidden/selected `lang` field carrying the chosen code. `POST /init/submit` reads `lang` from the form body, validates it against the six codes (400 if missing/invalid — this can only happen via a malformed direct request, since the UI always sends a valid value), and passes it to `initializeCompanyOs(language)`.

**Rationale**: Keeps the "no OS content created until a language is confirmed" rule (FR-004/FR-005) structurally true — there is still exactly one submit action, now carrying one extra field, rather than a separate round trip that could be skipped. Reuses the existing form-POST + Route Handler pattern from spec 014 instead of introducing a new API shape.

**Alternatives considered**: A separate "confirm language" step with its own POST before the creation button appears → rejected: two round trips for one decision, and reopens the double-submit race spec 014's research.md §4 already closed by keeping creation to a single request.

## §6. Application-wide UI translation: a small custom dictionary, not a locale-routing library

**Decision**: `lib/i18n/dictionaries/{en,it,ru,fr,de,es}.ts` each export a flat object of the same string keys in that language. `resolveLanguage()` (research.md §7) returns the active `SupportedLanguage`; each top-level `page.tsx`/`layout.tsx` looks up the matching dictionary and passes the strings it needs down to any client components as props (the same pattern `app/init/page.tsx` already uses to pass `mcpUrl` to `McpConnectManual`). No new npm dependency.

Rough inventory of what needs translated strings: all 17 existing `.tsx` files under `frontend/app/` (`init/*`, `editor/*`, `settings/**/*`, `oauth/**/*`, `layout.tsx`), plus the human-facing JSON error messages returned by route handlers that a page's own client-side code surfaces to a visitor (e.g. `/init/submit`'s `401`, `/oauth/login/submit`'s error responses, `/settings/personal-access-tokens/create`'s validation errors) — not the machine-facing MCP/OAuth protocol routes (research.md §8).

**Rationale**: This app has no locale-prefixed routing (`/en/editor`, `/it/editor`, …) and, per FR-007/spec clarifications, never will — there's exactly one active language per Company OS, chosen once, not a per-request locale segment in the URL. A library like `next-intl` is built around exactly that URL-locale-prefix model (or at least a routing middleware assumption) that this app's fixed paths (`/init`, `/editor`, `/oauth/authorize`, …) don't use and shouldn't be restructured to fit. A flat dictionary plus prop-passing is simpler, has zero new dependency surface, and matches this codebase's existing "compose small `lib/*` primitives directly" style (specs 001-014).

**Alternatives considered**:
- `next-intl` / `next-i18next` → rejected: designed around per-request locale routing (URL prefixes or domain-based locale detection) that doesn't fit this app's single-global-language, fixed-path model; would force restructuring every route under a `[locale]` segment for no benefit here.
- A React Context provider carrying the dictionary → considered, but not needed: every page that needs translated strings is already a server component with direct access to `resolveLanguage()`; prop-passing to the handful of client components (`EnvSetupHelper`, `LanguageConfirm`, `FileTree`, etc.) is simpler than threading a client-side context provider through the tree for a value that never changes mid-session.

## §7. Where `resolveLanguage()` is called, and avoiding duplicate reads per request

**Decision**: `resolveLanguage(): Promise<SupportedLanguage>` (`lib/i18n/resolve.ts`) is the single entry point every page/layout calls:

1. Call `checkOsStatus()` (existing, spec 014).
2. If not `"already_initialized"` → no Company OS with a language exists yet; return `detectBrowserLanguage(headers().get("accept-language"))` (FR-014, live, not persisted).
3. If `"already_initialized"` → call `getSystemLanguage()` (research.md §3). If it returns a code, use it (FR-008). If it returns `null` (a Company OS that predates this feature), return `"en"` (FR-013) — no detection, no asking.

Wrapped in React's `cache()` so multiple calls within the same request (e.g. root `layout.tsx` and the page it wraps) share one result instead of re-reading `os/language`/re-checking `os/`+`data/` per call.

**Rationale**: This directly encodes the spec's three-way split (FR-008 normal case, FR-013 legacy-OS fallback, FR-014 pre-confirmation live detection) as one function every route calls the same way, rather than each page re-deriving the same branching logic. `cache()` is the standard React/Next.js per-request memoization primitive already idiomatic in Server Components — no manual request-scoped singleton needed.

**Alternatives considered**: Resolve language once in `middleware.ts` and forward it via a request header → rejected: `os/language` requires an S3 read, which `middleware.ts` (edge-adjacent, meant for cheap checks — see spec 014 research.md §8's rationale for keeping it to a presence check) shouldn't take on; keeping the resolution in Server Components (which already make S3 calls freely) is simpler and consistent with how `checkOsStatus()` itself is already only called from page components, not middleware.

## §8. Scope boundary: machine-facing MCP/OAuth responses stay in English

**Decision**: Per the spec's clarification, `resolveLanguage()`/dictionaries are used only by human-facing pages and the route handlers whose JSON responses a page's own client-side code renders as text for a visitor to read (e.g. `/init/submit`, `/oauth/login/submit`, `/settings/personal-access-tokens/create`). The MCP server route (`/mcp`), its tool descriptions and error messages, and the OAuth *protocol* routes consumed by clients rather than rendered for a human (`/oauth/token`, `/oauth/register`, `/oauth/revoke`, `/.well-known/*`) are untouched by this feature and remain in English.

**Rationale**: Directly implements the clarification session's second answer — these responses are consumed by AI assistants/OAuth client libraries, not read by a person in their own language, so translating them wouldn't serve the feature's actual goal and would substantially (and pointlessly) inflate scope.

## §9. Testing approach

**Decision**: No automated test suite (consistent with specs 001-014) — validated via `quickstart.md`'s manual scenario walkthrough against a running `next dev` instance, switching the browser's language and toggling bucket contents between scenarios.

## §10. No retrofit path for already-initialized Company OS instances

**Decision**: Nothing in this feature reads or writes anything for a Company OS that already has `os/`+`data/` but no `os/language` file — `getSystemLanguage()` returning `null` for such an install is a normal, permanent, terminal state under `resolveLanguage()` (research.md §7), not an error or an incomplete-migration marker. No script, page, or prompt is added to backfill `os/language` onto an existing install.

**Rationale**: Directly implements the clarification session's decision that this feature only applies to new installations created from now on — an explicit, intentional scope boundary, not an oversight.
