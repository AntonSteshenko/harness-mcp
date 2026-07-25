# Feature Specification: Company OS Init Page

**Feature Branch**: `014-os-init-page`

**Created**: 2026-07-25

**Status**: Draft

**Input**: User description: "Add a new page at /init to the Next.js app that bootstraps a fresh 'Company OS' in the configured S3-compatible storage bucket. The page shows one of three states depending on whether storage is connected and whether it's already initialized (contains /os and /data folders): connection instructions, an 'already exists' message with a link to /editor, or a two-question setup form ('Come si chiama tua attività' / 'Cosa fa la tua attività') that creates /os, /data, /os/identity.md, a top-level AGENTS.md pointing to /os/skills/init.md, and a bundled /os/skills/init.md skill file."

## Clarifications

### Session 2026-07-25

- Q: Should the two setup-form questions stay in Italian (as originally written) while the rest of the `/init` page follows the app's existing English UI convention, or should the whole page — including the two questions — be in English? → A: Entire page in English, including the two setup-form questions; no Italian text anywhere on `/init`.
- Q: When storage isn't connected, should `/init` show static prose instructions, or an interactive helper? → A: An interactive form — the visitor enters the S3-compatible connection values (endpoint, region, access key ID, secret access key, bucket, path-style flag) and the page generates, entirely in the browser, two ready-to-paste configuration snippets (one `.env.local`-formatted for local dev, one formatted as a `NAME=value` list for pasting into a host's environment-variables UI, e.g. Vercel), each with a one-click copy action. The entered values are never transmitted to the server, logged, or persisted anywhere — the app has no ability to apply the configuration itself; the visitor copies the snippet and applies it themselves (editing `.env.local`, or pasting into their hosting provider's dashboard), then restarts/redeploys.
- Q (2026-07-25, post-implementation revision): Should this helper stay scoped to just the S3 storage values, and should it keep generating two near-identical snippets? → A: No — broaden it to cover every env var the app needs in one place (storage connection, owner sign-in username/password, and an optional system name), so a fresh install can be configured in a single pass instead of getting stuck again on the separate owner-credential requirement. And collapse the two snippets into one: the `.env.local` format and the Vercel-paste format are literally identical `NAME=value` lines, so showing two side by side was redundant — keep one generated snippet, and replace the second snippet block with plain manual instructions for applying it on Vercel (Project → Settings → Environment Variables → paste).
- Q (2026-07-25, post-implementation revision): Should `/init`'s two-question form still ask for the business name/description and write `/os/identity.md`, and should the "already initialized" state still be just a bare "already exists" message? → A: No, on both counts. The connected `os/skills/init.md` skill now conducts its own, much richer interview once an AI assistant is connected (business details, activity type, pricing, tone of voice, etc.) and writes `os/identity.md` itself as part of that — the app asking a much thinner version of the same two questions through a web form was redundant and got out of sync with what the skill actually produces. Removed the form entirely: the empty-bucket state is now a single confirmation button with no fields, creating only the skeleton (`os/`, `data/`, `AGENTS.md`, `os/skills/init.md`) with no business content. And once a Company OS exists (freshly created or already there), `/init` now shows instructions for connecting Claude/ChatGPT to the MCP server via OAuth — the natural next step, since that's how the owner actually reaches the skill that runs the real interview — instead of just a bare "already exists" message.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - First-time setup of a fresh Company OS skeleton (Priority: P1)

The owner, having already connected an S3-compatible storage backend but never run setup, visits `/init` and clicks a single confirmation action — no questions asked. The system creates the starting Company OS skeleton so that any AI assistant connecting via the MCP server has a working entry point (a router and an init skill) without the owner hand-authoring any files. Business-specific content (the company's identity, activity type, pricing, tone of voice, etc.) is deliberately not collected here — that happens later, conversationally, when a connected AI assistant reads the init skill and interviews the owner directly (User Story 3).

**Why this priority**: This is the core value of the feature — turning an empty, freshly-connected bucket into a usable Company OS entry point with zero manual file creation. Without this, the feature has no purpose.

**Independent Test**: Point the app at a freshly created, empty bucket, visit `/init`, confirm the single action, then verify `/os`, `/data`, `/AGENTS.md`, and `/os/skills/init.md` all exist with the expected content — independently of the other two states.

**Acceptance Scenarios**:

1. **Given** storage is connected and the bucket contains neither an `/os` nor a `/data` folder, **When** the owner opens `/init`, **Then** the page shows a brief explanation and a single confirmation action — no text fields, no questions.
2. **Given** the owner confirms, **When** the action completes, **Then** the system creates `/os` and `/data` folders, writes a top-level `/AGENTS.md` that tells any connecting AI assistant to read `/os/skills/init.md` for guidance on operating the system, and writes the bundled `/os/skills/init.md` skill file — and creates nothing else (no `/os/identity.md` or other business-specific content).
3. **Given** the skeleton has just been created, **When** the confirmation is shown, **Then** the owner is shown the same guidance for connecting an AI assistant that User Story 3 describes, so they can immediately move on to the real interview.

---

### User Story 2 - Guidance when storage isn't connected yet (Priority: P2)

A new owner who hasn't configured anything yet visits `/init` first, before doing anything else. Instead of a confusing error or a form that would fail on submit, they get an interactive setup helper covering everything the app needs to run: storage connection, owner sign-in credential, and (optionally) a name for their system. They fill it in once, get a single ready-to-paste configuration snippet, apply it themselves (locally or on their hosting provider), and come back once it's live.

**Why this priority**: `/init` is a natural first stop for a new owner, so it must handle the "nothing is configured yet" case gracefully — otherwise the entry point to the product is broken for first-time users.

**Independent Test**: Point the app at an unreachable or unconfigured storage backend, visit `/init`, fill in the setup-helper fields, and verify a correct, copyable configuration snippet is produced instead of a form or an unhandled error — without anything being sent over the network.

**Acceptance Scenarios**:

1. **Given** storage configuration is missing, the endpoint is unreachable, credentials are rejected, or the configured bucket doesn't exist, **When** the owner opens `/init`, **Then** the page shows a setup helper with fields for the S3-compatible endpoint, region, access key ID, secret access key, bucket name, path-style flag, an owner username and password, and an optional system name — instead of the setup form.
2. **Given** the owner has filled in the setup-helper fields, **When** they finish typing, **Then** the page shows one copyable configuration snippet covering every field above, with a one-click copy action, and none of the entered values are sent to the server.
3. **Given** the setup-helper state is shown, **When** the owner applies the copied snippet outside the app (editing `.env.local`, or their host's dashboard) and restarts/redeploys, then reconnects/reloads `/init`, **Then** the page re-evaluates storage state and shows the form (or the "already exists" state, if applicable) instead of continuing to show the helper.

---

### User Story 3 - Connecting Claude/ChatGPT once a Company OS exists (Priority: P3)

An owner (or a teammate) visits `/init` after a Company OS already exists — whether it was just created by User Story 1 or already existed from before. Rather than being able to re-run setup and risk overwriting existing data, they're shown instructions for connecting Claude or ChatGPT to the MCP server via OAuth, since that connection is what actually lets an AI assistant read the init skill and run the real interview (or, for an already-populated system, do any other work).

**Why this priority**: Prevents accidental data loss from re-running initialization against a live system, and turns what used to be a dead-end confirmation into the actual next actionable step. Lower priority than P1/P2 because it's a guidance/safety layer rather than the feature's core value.

**Independent Test**: Point the app at a bucket that already contains both `/os` and `/data`, visit `/init`, and verify the page shows the MCP connection URL and OAuth instructions rather than a setup form or write action, with a link to `/editor` also available.

**Acceptance Scenarios**:

1. **Given** storage is connected and the bucket already contains both an `/os` folder and a `/data` folder, **When** the owner opens `/init`, **Then** the page shows the MCP server URL to add as a connector in Claude/ChatGPT, notes that OAuth sign-in happens automatically once added, and points at `/settings/connected-apps` to review or revoke connections.
2. **Given** this state is shown, **When** the owner looks for a way to re-run setup or overwrite the existing structure, **Then** no such option is presented anywhere on the page.
3. **Given** the skeleton was just created (User Story 1), **When** this state is shown immediately afterward, **Then** the page also briefly confirms what was created, in addition to the connection instructions.

---

### Edge Cases

- **Partial/interrupted setup**: only one of `/os` or `/data` exists (e.g. a previous setup attempt failed partway through). The page must not offer the setup form (to avoid overwriting a system that may be partially populated) and must not claim a fully-set-up system exists either — it shows a distinct message that the storage is in an unexpected, partially-initialized state and does not offer any write action.
- **Storage becomes unreachable mid-submit**: the connection is lost or a write fails partway through creating the structure. The owner sees a clear failure message (not a silent success), and the page re-evaluates to the appropriate state (likely "partial/interrupted setup," above) on the next visit rather than silently retrying.
- **Concurrent/duplicate submission**: the owner double-submits the form, or two people submit it around the same time against the same empty bucket. Only one Company OS structure is created; the system does not produce corrupted or duplicated content.
- **Storage connects but is not empty in an unrelated way**: the bucket contains unrelated files/folders but neither `/os` nor `/data`. This is treated the same as the "empty" case (User Story 1) — the confirmation action is offered, and only `/os`, `/data`, `/AGENTS.md`, and `/os/skills/init.md` are created, without touching unrelated existing content.
- **Owner leaves the setup-helper page before applying the snippet**: nothing has been sent or saved anywhere, so nothing needs to be undone — reopening `/init` later simply shows the same helper again (assuming storage is still not connected) with blank fields.
- **Owner pastes the generated snippet somewhere insecure** (e.g. a public chat): out of scope for the system to prevent — the secret access key is the owner's own credential, exactly as sensitive as if they'd typed it directly into `.env.local`; the helper's only responsibility is to never be the one to leak it (FR-015).
- **Storage was never configured at all** (fresh clone, fresh deploy, or — as discovered during this feature's own testing — an existing install with its configuration removed): the server process still starts (FR-016) and every route redirects to `/init` (FR-017) rather than the process refusing to start or individual routes failing with raw errors.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a page at `/init` that, on load, determines exactly one of three states — storage not connected, storage connected and already initialized, or storage connected and empty — and renders the corresponding content described in FR-002 through FR-004.
- **FR-002**: When storage is not connected (missing configuration, unreachable endpoint, rejected credentials, or a configured bucket that doesn't exist), the system MUST show an interactive setup helper (FR-014, FR-015) covering storage connection, the owner sign-in credential, and an optional system name, and MUST NOT show the setup form.
- **FR-003**: When storage is connected and the bucket already contains both an `/os` folder and a `/data` folder, the system MUST show instructions for connecting Claude/ChatGPT to the MCP server via OAuth (the MCP server URL to add as a connector, a note that OAuth sign-in happens automatically once added, and a pointer to `/settings/connected-apps` to review/revoke connections), MUST also provide a link to `/editor`, and MUST NOT offer any action that creates or overwrites the structure.
- **FR-004**: When storage is connected and the bucket contains neither an `/os` folder nor a `/data` folder, the system MUST show a brief explanation and a single confirmation action — no text fields or questions of any kind.
- **FR-005**: *(removed — no form fields exist to validate; see FR-004)*.
- **FR-006**: On confirmation, the system MUST create an `/os` folder and a `/data` folder in the configured storage bucket.
- **FR-007**: *(removed — the system MUST NOT create `/os/identity.md` or any other business-specific content; that is left entirely to the connected AI assistant's own interview via the init skill, FR-009)*.
- **FR-008**: On confirmation, the system MUST create a top-level `/AGENTS.md` file whose content instructs any connecting AI assistant that, for any question about how to operate this system, it should read the skill file at `/os/skills/init.md`.
- **FR-009**: On confirmation, the system MUST create `/os/skills/init.md` using a fixed, product-provided template (not authored by the owner) that gives a connecting AI assistant the guidance it needs to start operating a newly created Company OS — including running its own interview to establish the business's identity and other details.
- **FR-010**: After the skeleton is created, the system MUST show the same MCP-connection guidance described in FR-003/US3, optionally noting that the skeleton was just created, so the owner's very next step is connecting an AI assistant rather than a dead-end confirmation.
- **FR-011**: The system MUST only ever perform the creation described in FR-006, FR-008, FR-009 once per bucket — after `/os` and `/data` exist, `/init` MUST always show the "already exists"/MCP-connection state (FR-003) regardless of how many times it is visited or confirmed.
- **FR-012**: Whenever storage is connected (the "already initialized," "empty," and "partial state" cases), `/init` MUST require the same owner sign-in already required for `/editor` and the settings pages, redirecting a signed-out visitor to sign in before showing that state. When storage is *not* connected, the system MUST show the connection instructions (FR-002) without requiring sign-in first — the owner sign-in mechanism itself depends on a reachable storage backend, so it cannot be enforced (or completed) until storage is connected, and there is no data to protect yet in that state.
- **FR-013**: If `/os` and `/data` are found in an inconsistent partial state (only one of the two present), the system MUST show neither the setup form nor the "already exists" confirmation, but a distinct message indicating the storage is in an unexpected state and offer no write action.
- **FR-014**: The setup helper (FR-002) MUST let the visitor enter every value the app needs to run — the S3-compatible connection (endpoint, region, access key ID, secret access key, bucket name, path-style addressing flag), the owner sign-in credential (username, password), and an optional system name — and MUST generate, entirely client-side, one ready-to-use configuration snippet from those values, formatted as `NAME=value` lines (valid both as a local `.env.local` file and for pasting into a hosting provider's environment-variables UI), with a one-click copy action. The page MUST also show plain-text instructions for applying that same snippet on a hosting provider (e.g. Vercel: Project → Settings → Environment Variables) — a second, separately generated snippet is not needed, since the format is identical to the first.
- **FR-015**: The setup helper MUST NOT transmit, submit, log, or persist any value the visitor enters into it, anywhere — the generated snippet exists only in the visitor's browser for them to copy and apply themselves; the system MUST NOT attempt to apply the configuration on the visitor's behalf (no writing to `.env` files, no calling any hosting provider's API).
- **FR-016**: The system MUST NOT prevent its own server process from starting when storage (or the owner sign-in credential) is missing or misconfigured — it MUST still log the problem clearly, but MUST remain running and able to serve `/init`, rather than exiting (research.md §9). This supersedes spec 007's and spec 008's original fail-fast-at-startup behavior specifically for this case — discovered necessary because a process that never finishes starting can never serve `/init`'s setup helper (FR-002) at all, defeating this feature's purpose for the exact case it exists to handle (storage never configured in the first place).
- **FR-017**: When required storage configuration is entirely absent, the system MUST redirect every request — except to `/init` itself and the app's own static assets — to `/init`, so a freshly deployed or freshly cloned instance always lands the visitor on the setup helper (FR-002) instead of an error page on whatever route they happened to open first (research.md §9).

### Key Entities

- **Company OS structure**: the top-level `/os` and `/data` folders in the configured storage bucket that together mark a bucket as "initialized." `/os` holds the system's self-description and operating guidance; `/data` is reserved for the business's own content going forward. Business-specific content under either (including `/os/identity.md`) is created later by the connected AI assistant, not by this feature.
- **Agents entry point** (`/AGENTS.md`): a top-level document that directs any connecting AI assistant to the init skill for operating guidance.
- **Init skill** (`/os/skills/init.md`): a fixed, product-provided document (not user-authored, identical across every newly initialized Company OS) that orients a connecting AI assistant on how to start operating a freshly created Company OS — including conducting its own interview with the owner to establish the business's identity and other details, and writing whatever files that interview produces (e.g. `/os/identity.md`). This app has no role in, and no visibility into, that interview.
- **Setup template (ephemeral)**: the single configuration snippet generated in the visitor's browser by the setup helper (FR-014) from their entered storage, owner-credential, and system-name values. Not a stored entity — exists only transiently in the page's UI, never sent to or held by the server.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time owner with storage already connected can go from opening `/init` to a created Company OS skeleton in under 30 seconds — one confirmation action, no fields to fill in.
- **SC-002**: 100% of visits to `/init` against a bucket that already contains `/os` and `/data` show the MCP-connection guidance with a working link to `/editor` — never the confirmation action.
- **SC-003**: 100% of visits to `/init` while storage is not connected show the setup helper rather than an unhandled error or a form that would fail on submit.
- **SC-004**: 0% of `/init` confirmations against an already-initialized or partially-initialized bucket result in existing content under `/os` or `/data` being overwritten or lost.
- **SC-005**: After creating the skeleton, an owner can follow the shown MCP-connection instructions to add the server as a Claude/ChatGPT connector without needing any information not already on the page.
- **SC-006**: 0% of the values a visitor types into the setup helper are ever sent in a network request — verifiable by inspecting network activity while using it — and a visitor can go from typing in every field to having a single correctly formatted, copied snippet in under 2 minutes.

## Assumptions

- `/init` sits alongside the existing `/editor` and `/settings` pages and reuses the same owner sign-in gate (spec 009) rather than introducing a separate credential or an unauthenticated flow — consistent with every other page in the app that can read or write storage content.
- The page follows the app's existing convention of English UI copy throughout, including the two setup-form questions (see Clarifications).
- "Storage not connected" is detected using the same validation the app already performs at startup elsewhere (spec 007): missing configuration, unreachable endpoint, rejected credentials, or a missing bucket all count as "not connected" for `/init`'s purposes.
- The setup helper's field set mirrors exactly the variables documented in `frontend/.env.example` that are required for the app to run at all: the six S3 connection variables (spec 007) plus `OAUTH_OWNER_USERNAME`/`OAUTH_OWNER_PASSWORD` (spec 008), plus the optional `OS_NAME` branding variable. This was revised (2026-07-25, see Clarifications) from an earlier, narrower version scoped to storage only — bundling the owner credential in here too means a fresh install can be configured in one pass instead of getting stuck signing in after fixing storage alone (research.md §1's login/storage chicken-and-egg problem doesn't apply once both are set together). `MCP_BOOTSTRAP_PATH` (spec 010, advanced/optional, referencing a file that doesn't exist yet before setup) remains deliberately out of scope for this helper.
- The app never gains the ability to write its own configuration (no filesystem write to `.env*`, no hosting-provider API calls) — applying the generated snippet is always a manual step the visitor performs outside the app. This keeps the app's own permissions unchanged (it doesn't need write access to itself or credentials for a hosting provider's management API) and avoids handling the visitor's secret access key anywhere but their own browser.
- The `/os/skills/init.md` content is a single fixed template shipped with the app, identical for every newly initialized Company OS — it is not customized per business by this feature at all; any per-business customization (identity, activity type, pricing, etc.) happens later, when the skill itself interviews the owner through a connected AI assistant.
- The MCP-connection guidance (FR-003, FR-010) assumes OAuth (spec 008) is already configured (it's part of the setup helper, FR-014) — it doesn't re-explain OAuth setup itself, only how to point Claude/ChatGPT at the already-working `/mcp` endpoint.
- "Folder" here follows this app's existing object-storage convention (spec 001/002) of key-prefix-based directories, not a distinct storage primitive.
- No migration path is in scope: this feature only handles the empty-bucket case and the already-initialized case: it does not attempt to retrofit `/os`/`/data` onto a bucket that has unrelated pre-existing content structured differently.
- FR-016/FR-017's redirect-everything-to-`/init` behavior only triggers on a cheap presence check (are the required env vars set at all), not a live connectivity probe on every request — a reachable-but-wrong configuration (unreachable endpoint, rejected credentials, missing bucket) is not redirected globally; the visitor reaches it by visiting `/init` directly, which still performs the full, authoritative check (FR-002) exactly as before. Every other route's own behavior in that narrower case (misconfigured but not entirely absent) is unchanged by this feature.
