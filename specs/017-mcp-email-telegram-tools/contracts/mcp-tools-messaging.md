# Contract: `send_email` / `send_telegram_message`

**Input**: [spec.md](../spec.md), [data-model.md](../data-model.md), [research.md](../research.md)

**Adds (additively)**: Two new MCP tools. No existing tool (spec 002's filesystem tools, spec 016's `get_os_engine`/`get_os_upgrade`/`get_os_init`) is renamed, changed, or removed by this feature.

## Common error shape

Both tools return failures the same way every other tool in this server does (`lib/mcp-tools/result.ts`'s `errorResult()` convention): `isError: true` with a text content block whose JSON body is `{ code, message }`. This feature's error codes (research.md §6):

| Code | Meaning |
|---|---|
| `invalid_recipient` | A `to` address (email) failed validation. |
| `invalid_message` | Empty `subject`/`body`/`text`, or Telegram `text` exceeds 4096 characters. |
| `missing_config` | Required env var(s) for the requested channel are not set (data-model.md Messaging Configuration). |
| `rate_limited` | The shared send-rate limit (FR-011) has been reached; no delivery was attempted. |
| `unauthorized` | The Telegram Bot API rejected the request (bad token, bot not a member of the target chat, bot blocked). |
| `delivery_failed` | The SMTP server rejected the message or was unreachable, or the Telegram API returned an unexpected error, after passing all prior checks. |

Every send attempt — success or failure — is written to a Send Attempt Record (data-model.md) regardless of which of these applies.

## `send_email`

Sends an email via the pre-configured SMTP account.

- **Input**: `{ to: string[], subject: string, body: string }`
  - `to`: 1–50 email addresses.
- **Output**: `{ results: Array<{ to: string, status: "success" | "failure", errorCode?: string, errorMessage?: string }> }`
  - One entry per address in `to`, in the same order — this is how a caller sees a partial failure across a multi-recipient call (FR-010) without the whole call failing outright.
- **Errors** (whole-call failures, before any per-recipient attempt is made):
  - `invalid_message` — empty `subject` or `body`.
  - `missing_config` — SMTP is not configured.
  - `rate_limited` — rate limit already reached.
  - `invalid_recipient` — `to` is empty or has more than 50 entries.
- **Per-recipient errors** (inside a successful call's `results` array, one address at a time): `invalid_recipient` (malformed address), `delivery_failed` (SMTP server rejected that recipient or the connection failed).
- **Satisfies**: spec 017 FR-001, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009, FR-010, FR-011.

## `send_telegram_message`

Sends a text message via the pre-configured Telegram bot, to `chatId` if given, otherwise to the server's configured default chat (`telegramChatId`, clarified post-implementation 2026-07-27).

- **Input**: `{ chatId?: string, text: string }` — `chatId` is optional; when omitted, the tool uses the configured default.
- **Output**: `{ chatId: string, status: "success" }` on success — `chatId` reflects whichever chat was actually used (caller-supplied or the default).
- **Errors**: `invalid_message` (empty `text` or over 4096 characters); `missing_config` (bot token not set, or `chatId` omitted with no default configured); `rate_limited`; `unauthorized` (bot cannot reach `chatId`); `delivery_failed` (unexpected Telegram API error).
- **Satisfies**: spec 017 FR-002, FR-004, FR-005, FR-006, FR-007, FR-008, FR-011.

## Cross-cutting

- Both tools share one rate limit (data-model.md Rate Limit State) — a caller hitting the limit via `send_email` also blocks `send_telegram_message` until the window resets, and vice versa (FR-011).
- Neither tool accepts credentials as input — both always use the server's configured Messaging Configuration (FR-005). There is no per-call "from account" or "bot token" parameter.
- Neither tool performs deduplication — two calls with identical content are both sent and both recorded independently (spec.md Edge Cases, clarification session 2026-07-27).
- No attachments, HTML templating engine, or Telegram rich-content (inline keyboards, media) are in scope (spec.md Assumptions).
