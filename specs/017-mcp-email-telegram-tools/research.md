# Research: MCP Email & Telegram Messaging Tools

**Input**: [spec.md](./spec.md)

No `[NEEDS CLARIFICATION]` markers remain in the spec (resolved during `/speckit-clarify`). This document resolves the implementation-level unknowns needed to fill in Technical Context and move to Phase 1 design.

## §1 SMTP client library

**Decision**: Use `nodemailer` (new dependency) as the SMTP client for `send_email`.

**Rationale**: The spec explicitly calls for SMTP (not a transactional-email HTTP API like SendGrid/Postmark), and `nodemailer` is the de facto standard Node.js SMTP client — mature, MIT-licensed, handles STARTTLS/implicit TLS, auth mechanisms, and connection teardown correctly. Reimplementing the SMTP protocol by hand would be significant, error-prone surface area for no benefit.

**Alternatives considered**:
- Raw `net`/`tls` socket SMTP implementation — rejected: reinvents a well-solved protocol, high risk of subtle bugs (line-ending handling, auth negotiation, TLS upgrade).
- A transactional-email HTTP API (SendGrid, Postmark, etc.) — rejected: the spec's input explicitly says SMTP, and adding a third-party paid API contradicts this repo's self-hosted, bring-your-own-mail-account posture (mirrors the existing bring-your-own-S3-endpoint pattern in spec 007).

## §2 Telegram integration

**Decision**: Call the Telegram Bot API's `sendMessage` endpoint directly via Node's built-in `fetch` (`https://api.telegram.org/bot<token>/sendMessage`) — no bot-framework library.

**Rationale**: The feature only ever needs one outbound call (send a message to a known chat ID); libraries like `telegraf` or `node-telegram-bot-api` are built around receiving updates (polling/webhooks), inline keyboards, and session state — none of which this feature uses. A single `fetch` POST keeps the dependency footprint at zero for this half of the feature, consistent with how the rest of this codebase favors built-in `fetch` over HTTP client libraries.

**Alternatives considered**:
- `node-telegram-bot-api` / `telegraf` — rejected: pulls in polling/webhook machinery unrelated to one-shot outbound sends.

## §3 Rate limit storage & algorithm

**Decision**: A fixed-window counter (window + count), persisted as a JSON record in the existing S3/MinIO bucket under a new reserved prefix (`.messaging/rate-limit.json`), read-check-then-write — the same best-effort, non-atomic pattern already accepted in `lib/oauth/rateLimit.ts` for login-attempt tracking (spec 008, research.md §3 there).

**Rationale**: This app deploys to Vercel (spec 006/007/008), where serverless function instances are ephemeral and not guaranteed to share memory — an in-process counter would silently under-count across cold starts or concurrent instances. The bucket is already the app's one persistent, shared store (used today for OAuth state); reusing it avoids introducing a new piece of infrastructure (e.g. Redis/Upstash) for a single counter, and keeps the whole app's state in one place.

**Alternatives considered**:
- In-memory counter — rejected: doesn't survive cold starts or multiple concurrent instances, undermining the abuse-prevention purpose of FR-011.
- A dedicated rate-limiting service/store (e.g. Upstash Redis) — rejected: net-new infrastructure dependency for one counter, when the existing bucket already serves this exact role for OAuth; not justified by scale (this is a single-deployment, internal automation tool, not a public API).

**Trade-off accepted**: Under concurrent requests, the non-atomic read-check-write can let a small number of requests slip past the limit right at the boundary. Acceptable for an abuse *deterrent* (catching runaway loops), not a hard security boundary — same judgment call already made for the OAuth login-attempt limiter.

## §4 Send-attempt audit log storage

**Decision**: One JSON record per send attempt under `.messaging/send-log/<id>.json` (mirrors `lib/oauth/store.ts`'s `getRecord`/`putRecord`/`listRecords` helpers, reused via a small `lib/messaging/store.ts` wrapper over the same bucket/prefix convention), `id` a random opaque token generated with `node:crypto`'s `randomBytes` (same primitive already used for OAuth tokens).

**Rationale**: Matches the existing precedent exactly (spec 008's `PersonalAccessToken` records under `.oauth/pats/`), so anyone maintaining this feature already knows the pattern from the OAuth code.

**Alternatives considered**: A single append-only log file — rejected: would require read-modify-write of a growing file on every send, worse contention/perf characteristics than one small object per attempt (same reasoning already applied to the OAuth store's per-entity-file design).

## §5 Email address validation

**Decision**: A lightweight regex check (RFC 5322 "good enough" pattern, not a full RFC-5322 parser) applied per-recipient before attempting delivery.

**Rationale**: Full RFC 5322 validation is famously overkill and still doesn't guarantee deliverability (mailbox existence can only be confirmed by attempting delivery). A practical regex catches the actual failure mode this feature cares about — obviously malformed input — cheaply, with no new dependency, consistent with this codebase's preference for small self-contained validation (see `lib/storage/paths.ts`'s hand-rolled path validation).

**Alternatives considered**: A dedicated email-validation npm package — rejected: unnecessary dependency weight for a check this simple.

## §6 Error surface

**Decision**: Introduce a `MessagingError` class (mirrors `lib/storage/errors.ts`'s `StorageError`) with codes `invalid_recipient`, `invalid_message`, `missing_config`, `rate_limited`, `unauthorized`, `delivery_failed` — covering, respectively, FR-003/FR-004 input validation, FR-005/FR-008 configuration, FR-011 rate limiting, Telegram-specific bot-cannot-reach-chat failures, and generic provider/delivery failures (FR-007's three-way distinction: input vs. configuration vs. delivery). A parallel `messagingErrorResult()` helper (same `{ isError: true, content: [{ type: "text", text: JSON.stringify({ code, message }) }] }` shape as `lib/mcp-tools/result.ts`'s existing `errorResult()`) wraps it for tool responses; the existing `ok()` helper is reused as-is since it is already generic.

**Rationale**: Keeps the same caller-facing error shape callers already branch on for the filesystem tools (`{ code, message }`), so an MCP client doesn't need a second parsing convention. A separate error class (rather than extending `StorageError`) keeps messaging failures semantically distinct from storage failures, matching how `OAuthError`/`StorageConfigError` are already kept as siblings rather than one shared class.

## §7 Configuration surface

**Decision**: New environment variables, read once via a `lib/messaging/config.ts` mirroring `lib/storage/config.ts`'s never-throws-at-import-time / explicit-`validate*()` pattern:

- `SMTP_HOST`, `SMTP_PORT` (default `587`), `SMTP_SECURE` (default `false`, STARTTLS on 587), `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` (display name + address used as the sender identity, FR-005/FR-009-equivalent)
- `TELEGRAM_BOT_TOKEN`
- `MESSAGING_RATE_LIMIT_MAX` (default `20`), `MESSAGING_RATE_LIMIT_WINDOW_MINUTES` (default `60`) — admin-configurable per FR-011

**Rationale**: Matches the existing `S3_*` / `OAUTH_OWNER_*` naming convention (prefix by concern, plain env vars, sensible defaults for optional fields, required fields left empty by default) and the "never throw at import time, validate explicitly" rule that lets Next.js's build-time module collection succeed even when the real environment isn't loaded yet.

**Validation is per-tool-call, not startup-fatal**: unlike storage (core to the whole app) but like the OAuth owner credential (spec 014's relaxed pattern), missing SMTP/Telegram config is logged as a startup warning (via `instrumentation.ts`) but does not block the app from serving other requests — a `missing_config` `MessagingError` is returned only when the corresponding tool is actually called with no valid configuration.
