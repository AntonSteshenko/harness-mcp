# Quickstart: Validate MCP Email & Telegram Messaging Tools

Manual validation guide (this project has no automated test suite — see `research.md` §7). Run these scenarios against a running `next dev` instance after implementation, using an MCP client or `curl` (as in spec 013's quickstart) against `/mcp`.

## Prerequisites

- MinIO/S3-compatible storage stack running and configured (spec 001) — used for the rate-limit counter and send-attempt log (data-model.md).
- `frontend`: `npm install && npm run dev`.
- An MCP session already authenticated (OAuth or personal access token, specs 008/013) so `tools/call` requests succeed.
- A real (or disposable, e.g. Mailtrap/Ethereal) SMTP account and its host/port/user/password, plus a Telegram bot token (from `@BotFather`) already added to a test chat, to fill in:
  ```
  SMTP_HOST=...
  SMTP_PORT=587
  SMTP_SECURE=false
  SMTP_USER=...
  SMTP_PASSWORD=...
  SMTP_FROM="Risorse OS <noreply@example.com>"
  TELEGRAM_BOT_TOKEN=...
  MESSAGING_RATE_LIMIT_MAX=20
  MESSAGING_RATE_LIMIT_WINDOW_MINUTES=60
  ```

## Scenario 1 — Send an email successfully (US1, FR-001, FR-006, SC-001)

1. Call `send_email` with `{ to: ["you@example.com"], subject: "Quickstart", body: "hello from harness-mcp" }`.
2. **Expect**: response `results: [{ to: "you@example.com", status: "success" }]`, delivered within ~5s; the email arrives in the inbox.

## Scenario 2 — Invalid recipient is caught before sending (US1, FR-003, Edge Cases)

1. Call `send_email` with `{ to: ["not-an-email"], subject: "x", body: "x" }`.
2. **Expect**: `results: [{ to: "not-an-email", status: "failure", errorCode: "invalid_recipient" }]` — no connection to the SMTP server was attempted.

## Scenario 3 — Mixed valid/invalid recipients (FR-010)

1. Call `send_email` with `{ to: ["you@example.com", "not-an-email"], subject: "x", body: "x" }`.
2. **Expect**: two entries in `results` — one `success` for the valid address, one `failure`/`invalid_recipient` for the other; the valid recipient still receives the email.

## Scenario 4 — SMTP misconfiguration (FR-005, FR-007, FR-008)

1. Temporarily unset `SMTP_HOST` (or point it at an unreachable host) and restart `next dev`.
2. Call `send_email` with valid input.
3. **Expect**: a whole-call `missing_config` (unset) or per-recipient `delivery_failed` (unreachable) error — distinguishable from `invalid_recipient` in Scenario 2.
4. Restore the correct `SMTP_HOST` and restart.

## Scenario 5 — Send a Telegram message successfully (US2, FR-002, FR-006, SC-002)

1. Call `send_telegram_message` with `{ chatId: "<your test chat id>", text: "hello from harness-mcp" }`.
2. **Expect**: `{ chatId, status: "success" }`, delivered within ~3s; the message appears in the chat.

## Scenario 6 — Bot cannot reach the chat (US2, Edge Cases)

1. Call `send_telegram_message` with a `chatId` the bot was never added to (or an obviously invalid one).
2. **Expect**: `errorCode: "unauthorized"` (or `delivery_failed` if Telegram's response doesn't distinguish it), no message delivered.

## Scenario 7 — Oversized Telegram message rejected before sending (FR-004)

1. Call `send_telegram_message` with `text` longer than 4096 characters.
2. **Expect**: `invalid_message` — verify (e.g. via bot logs or absence in chat) that no request reached the Telegram API.

## Scenario 8 — Rate limit is enforced and shared across both tools (FR-011, clarified 2026-07-27)

1. Set `MESSAGING_RATE_LIMIT_MAX=2` and `MESSAGING_RATE_LIMIT_WINDOW_MINUTES=60`, restart `next dev`.
2. Call `send_email` twice successfully (Scenario 1's input).
3. Call `send_telegram_message` once (Scenario 5's input).
4. **Expect**: the third call (regardless of which tool) is rejected with `rate_limited`, and no message is delivered for it — proving the limit is shared, not per-tool.
5. Restore the original rate-limit values and restart.

## Scenario 9 — Every attempt is recorded, success or failure (US3, FR-006, FR-008, SC-005)

1. After running Scenarios 1–8, inspect the send-attempt records under `.messaging/send-log/` in the configured bucket (e.g. via the MinIO console or `list_directory`/`read_file` if not excluded from the file explorer — see data-model.md).
2. **Expect**: one record per attempt above (per-recipient for the multi-recipient Scenario 3), each with `channel`, `destination`, `timestamp`, `status`, and — for failures — a non-null `errorCode`/`errorMessage`.

## Scenario 10 — Duplicate calls are both sent, not deduplicated (Edge Cases, clarified 2026-07-27)

1. Call `send_telegram_message` with identical `{ chatId, text }` twice in immediate succession.
2. **Expect**: both calls succeed independently and both messages appear in the chat — confirming no automatic deduplication.
