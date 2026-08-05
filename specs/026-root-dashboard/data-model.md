# Phase 1 Data Model: Root Dashboard Page

This feature introduces no persisted data, no new storage records, and no state transitions. It has exactly one code-level entity, matching the spec's Key Entities section.

## DashboardLink

Represents one entry on the dashboard: a display label and the destination page it points to. Defined as static, in-code data (see research.md §4) — not stored in the S3-backed record store used elsewhere in this app.

| Field      | Type   | Description                                                                 |
|------------|--------|-------------------------------------------------------------------------------|
| `href`     | string | The destination route, e.g. `/files`, `/tools`, `/settings/connected-apps`  |
| `labelKey` | string | Which string in the `dashboard` dictionary namespace supplies the link's display text (resolved per the visitor's language via `getDictionary`) |

### Fixed instances (FR-002, FR-004)

| `href`                              | Represents            |
|--------------------------------------|------------------------|
| `/files`                             | Files (browse + edit) |
| `/tools`                             | Tools                 |
| `/settings/connected-apps`           | Settings › Connected Apps |
| `/settings/personal-access-tokens`   | Settings › Personal Access Tokens |

Explicitly not represented as a `DashboardLink` (research.md §2): `/init`, `/oauth/login`, `/oauth/authorize`, `/tools/[name]/confirm`, `/editor/[[...path]]`.

### Validation rules

- `href` must be one of the app's existing top-level, user-navigable routes (FR-002); flow-only and redirect-only routes are excluded (FR-004).
- `labelKey` must resolve to a non-empty string in all six locale dictionaries (`en`, `it`, `es`, `fr`, `de`, `ru`) — enforced structurally by extending the shared `Dictionary` TypeScript interface in `lib/i18n/dictionaries/types.ts`, so a missing translation is a compile error, not a runtime gap.

### Relationships

None — `DashboardLink` entries are independent of each other and of any persisted domain entity (files, tools, tokens, grants). They only reference existing routes by literal path string.
