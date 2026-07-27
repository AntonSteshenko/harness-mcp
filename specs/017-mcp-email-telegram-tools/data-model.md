# Data Model: MCP Email & Telegram Messaging Tools

**Input**: [spec.md](./spec.md) Key Entities, [research.md](./research.md)

## Email Message

Represents a single outbound email (spec.md FR-001, FR-003, FR-004, FR-009, FR-010, FR-011). Not persisted itself — it exists only for the duration of one tool call; what *is* persisted is the resulting Send Attempt Record (below).

| Field | Type | Required | Notes |
|---|---|---|---|
| `to` | string[] (email addresses) | Yes, 1–50 entries | Validated per-address (research.md §5); FR-010's cap rejects the call outright above 50. |
| `subject` | string | Yes, non-empty | |
| `body` | string | Yes, non-empty | Plain text; basic HTML MAY be accepted (FR-009) — treated as opaque text either way, no template engine. |
| sender identity | — | N/A | Not a caller-supplied field — always the configured `SMTP_FROM` (research.md §7, FR-005). |

**Validation rules**:
- Every address in `to` MUST pass the regex check (research.md §5); a call with a mix of valid/invalid addresses reports per-recipient outcome (FR-010) rather than failing the whole call for one bad address.
- `subject`/`body` MUST NOT be empty (FR-004).
- `to.length` MUST NOT exceed 50 (FR-010) — this check fails the whole call before any delivery attempt, unlike per-address validation.

## Telegram Message

Represents a single outbound Telegram message (spec.md FR-002, FR-004). Likewise not persisted itself.

| Field | Type | Required | Notes |
|---|---|---|---|
| `chatId` | string | No | Telegram chat/channel identifier (numeric ID or `@channelusername`); passed through to the Bot API, not independently validated beyond non-empty when supplied. If omitted, falls back to the configured `telegramChatId` default (Messaging Configuration, clarified post-implementation 2026-07-27) — a call fails with `missing_config` if neither is present. |
| `text` | string | Yes, non-empty, ≤ 4096 chars | Telegram's own message-length limit (FR-004); checked before calling the Bot API. |

## Send Attempt Record

The outcome of one call to either tool (spec.md FR-006, FR-007, FR-008, User Story 3). One JSON object persisted per attempt (research.md §4).

| Field | Type | Notes |
|---|---|---|
| `id` | string | Opaque, randomly generated (research.md §4); also the storage key. |
| `channel` | `"email"` \| `"telegram"` | |
| `destination` | string | Recipient address (email) or `chatId` (Telegram); for a multi-recipient email call, one record is written per recipient so each has its own outcome (consistent with FR-010's per-recipient reporting). |
| `timestamp` | string (ISO 8601) | When the attempt completed. |
| `status` | `"success"` \| `"failure"` | |
| `errorCode` | `MessagingErrorCode \| null` | One of research.md §6's codes; `null` on success. |
| `errorMessage` | string \| null | Human-readable reason (FR-006); `null` on success. |

**Lifecycle**: Write-once, immutable, never updated after creation. No deletion/retention policy in this feature (spec.md Assumptions don't mention retention; out of scope — records simply accumulate under `.messaging/send-log/`, same as OAuth's existing per-entity records under `.oauth/`).

## Messaging Configuration

The administrator-provisioned settings both tools depend on (spec.md FR-005, FR-008, Assumptions). Loaded once per process from environment variables (research.md §7) — not stored in the bucket, not caller-suppliable.

| Field | Type | Required | Notes |
|---|---|---|---|
| `smtpHost` | string | Yes (to use `send_email`) | |
| `smtpPort` | number | No (default `587`) | |
| `smtpSecure` | boolean | No (default `false`) | `true` = implicit TLS; `false` = STARTTLS on the given port. |
| `smtpUser` | string (secret) | Yes | Never logged. |
| `smtpPassword` | string (secret) | Yes | Never logged. |
| `smtpFrom` | string | Yes | Sender identity (display name + address) stamped on every outbound email. |
| `telegramBotToken` | string (secret) | Yes (to use `send_telegram_message`) | Never logged. |
| `telegramChatId` | string | No | Default chat/channel used when a `send_telegram_message` call omits `chatId`. |
| `rateLimitMax` | number | No (default `20`) | Max sends per window, shared across both tools (FR-011). |
| `rateLimitWindowMinutes` | number | No (default `60`) | |

**Validation rules**: Each tool independently checks its own required fields are present before attempting a send; a missing/incomplete config surfaces as a `missing_config` `MessagingError` naming the missing env var(s), mirroring `StorageConfigError`'s pattern — not a startup-fatal error (research.md §7).

## Rate Limit State

Shared counter enforcing FR-011, persisted as a single JSON record (research.md §3) — not one of the spec's Key Entities, but needed to implement one (Messaging Configuration's `rateLimitMax`/`rateLimitWindowMinutes`).

| Field | Type | Notes |
|---|---|---|
| `windowStart` | string (ISO 8601) | Start of the current fixed window. |
| `count` | number | Sends recorded since `windowStart`. |

**Behavior**: On each send attempt, if `now - windowStart >= rateLimitWindowMinutes`, the window resets (`windowStart = now`, `count = 0`) before checking; otherwise if `count >= rateLimitMax` the call is rejected with a `rate_limited` `MessagingError` and no send is attempted (FR-011). On a successful pass, `count` is incremented and the record is written back (best-effort, non-atomic — research.md §3).

## Relationships

- Every Email Message and Telegram Message send attempt produces exactly one (or, for multi-recipient email, one *per recipient*) Send Attempt Record — independent of whether the attempt succeeded (FR-006, FR-008).
- Every send attempt is checked against the single shared Rate Limit State before Messaging Configuration is used to actually contact the SMTP server / Telegram API (FR-011) — the check happens first so a rate-limited call never touches an external provider.
- Both tools read the same Messaging Configuration but populate independent sections of it (`smtp*` vs. `telegramBotToken`) — neither tool depends on the other's fields being present.
