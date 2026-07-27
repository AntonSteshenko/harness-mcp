---

description: "Task list template for feature implementation"
---

# Tasks: MCP Email & Telegram Messaging Tools

**Input**: Design documents from `/specs/017-mcp-email-telegram-tools/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Not requested for this feature (plan.md Testing: no automated test suite in this project; validated via `quickstart.md`'s manual scenario walkthrough, consistent with specs 001-016). No test tasks are included; quickstart scenarios are run as manual validation tasks within each story's phase instead.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. User Story 1 (send an email) and User Story 2 (send a Telegram message) are both Priority P1 and together form the MVP; User Story 3 (see why a send attempt failed) is P2 and is delivered as a side effect of US1/US2 writing a Send Attempt Record on every call, so its phase is validation-only (plus the one cross-tool rate-limit check that only makes sense once both tools exist).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Single Next.js app at `frontend/` (same app as every prior spec): new domain logic under `frontend/lib/messaging/`, new tool registration in `frontend/lib/mcp-tools/messagingTools.ts`. No `tests/` directory — no automated tests requested.

---

## Phase 1: Setup

**Purpose**: New dependency and configuration surface this feature needs, before any messaging code is written

- [X] T001 [P] Add `nodemailer` and its `@types/nodemailer` dev-dependency to `frontend/package.json`, then run `npm install` from `frontend/` (research.md §1)
- [X] T002 [P] Add `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `TELEGRAM_BOT_TOKEN`, `MESSAGING_RATE_LIMIT_MAX`, `MESSAGING_RATE_LIMIT_WINDOW_MINUTES` to `frontend/.env.example`, each with a short descriptive comment in the same style as the existing `S3_*`/`OAUTH_OWNER_*` entries, noting defaults where applicable (`587`/`false`/`20`/`60`) (research.md §7, data-model.md Messaging Configuration)

**Checkpoint**: Dependency installed, configuration surface documented — ready for Foundational implementation

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared error types, config reader, S3-backed record store, rate limiter, audit logger, and tool-registration skeleton that both `send_email` and `send_telegram_message` depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 [P] Create `frontend/lib/messaging/errors.ts` exporting `MessagingErrorCode` (`"invalid_recipient" | "invalid_message" | "missing_config" | "rate_limited" | "unauthorized" | "delivery_failed"`) and a `MessagingError` class with `code`/`message`, mirroring `frontend/lib/storage/errors.ts`'s `StorageError` shape exactly (research.md §6, contracts/mcp-tools-messaging.md "Common error shape")
- [X] T004 [P] Create `frontend/lib/messaging/validation.ts` exporting `isValidEmailAddress(address: string): boolean` (lightweight RFC-5322-ish regex, no external dependency, research.md §5) and `isValidMessageLength(text: string, maxLength: number): boolean` (non-empty and `<= maxLength`)
- [X] T005 [P] Create `frontend/lib/messaging/store.ts` exporting `getRecord<T>(key: string): Promise<T | undefined>`, `putRecord<T>(key: string, value: T): Promise<void>`, and `listRecords<T>(prefix: string): Promise<T[]>` over a reserved `.messaging/` bucket prefix, copying `frontend/lib/oauth/store.ts`'s exact pattern (same `s3Client`/`BUCKET` imports from `frontend/lib/storage/client`, same JSON get/put, not-found treated as `undefined`) (research.md §3, §4)
- [X] T006 Create `frontend/lib/messaging/config.ts` exporting a `MessagingConfig` interface (`smtpHost`, `smtpPort`, `smtpSecure`, `smtpUser`, `smtpPassword`, `smtpFrom`, `telegramBotToken`, `rateLimitMax`, `rateLimitWindowMinutes` — data-model.md Messaging Configuration), `readMessagingConfig(): MessagingConfig` that reads `process.env` without throwing (mirrors `frontend/lib/storage/config.ts`'s `readStorageConfig()`; defaults `smtpPort` 587, `smtpSecure` false, `rateLimitMax` 20, `rateLimitWindowMinutes` 60), and `validateEmailConfig(config)`/`validateTelegramConfig(config)` that each throw a `missing_config` `MessagingError` (T003) naming every missing required field for that channel (research.md §7) — depends on T003
- [X] T007 Create `frontend/lib/messaging/rateLimit.ts` exporting `checkAndRecordSend(config: MessagingConfig): Promise<void>` that reads the single rate-limit record via `getRecord`/`putRecord` (T005) at key `rate-limit` (stored under `.messaging/rate-limit.json`), resets to `{ windowStart: now, count: 0 }` when `now - windowStart >= rateLimitWindowMinutes`, throws a `rate_limited` `MessagingError` (T003) without writing when `count >= rateLimitMax`, otherwise increments `count` and writes the record back before returning (data-model.md Rate Limit State, research.md §3) — depends on T003, T005, T006
- [X] T008 [P] Create `frontend/lib/messaging/auditLog.ts` exporting `recordSendAttempt(entry: { channel: "email" | "telegram"; destination: string; status: "success" | "failure"; errorCode?: MessagingErrorCode; errorMessage?: string }): Promise<void>` that generates an opaque id via `randomBytes(16).toString("hex")` (`node:crypto`, mirrors `frontend/lib/oauth/tokens.ts`'s token generation), stamps `timestamp: new Date().toISOString()`, and writes the resulting Send Attempt Record (data-model.md) via `putRecord` (T005) at key `send-log/<id>` (stored under `.messaging/send-log/<id>.json`) — depends on T005
- [X] T009 Create `frontend/lib/mcp-tools/messagingTools.ts` exporting an empty `registerMessagingTools(server: McpServer): Promise<void>` (no tools registered yet — US1/US2 populate it below) plus a local `messagingErrorResult(err: unknown): CallToolResult` helper that maps a `MessagingError` (T003) to `{ isError: true, content: [{ type: "text", text: JSON.stringify({ code: err.code, message: err.message }) }] }`, the same shape as `frontend/lib/mcp-tools/result.ts`'s existing `errorResult()` (reuse that file's `ok()` as-is for success responses); then add `await registerMessagingTools(server);` to `frontend/app/mcp/route.ts` alongside the existing `registerTools`/`registerEngineTools` calls (plan.md Project Structure) — depends on T003

**Checkpoint**: Foundation ready — User Story 1 and User Story 2 implementation can now begin (in parallel, if staffed)

---

## Phase 3: User Story 1 - Send an email notification (Priority: P1) 🎯 MVP

**Goal**: `send_email` delivers a message via the configured SMTP account given `to`/`subject`/`body`, validating recipients and rejecting oversized recipient lists before attempting delivery, respecting the shared rate limit, and recording every attempt.

**Independent Test**: Call `send_email` with a valid recipient and confirm delivery within ~5s (quickstart.md Scenario 1); call it with a malformed address and confirm rejection with no SMTP connection attempted (Scenario 2); mix valid/invalid recipients and confirm per-recipient outcomes (Scenario 3); misconfigure SMTP and confirm a distinguishable error (Scenario 4).

### Implementation for User Story 1

- [X] T010 [US1] Create `frontend/lib/messaging/email.ts` exporting `sendEmailToRecipient(to: string, subject: string, body: string, config: MessagingConfig): Promise<void>` that builds a `nodemailer.createTransport({ host: config.smtpHost, port: config.smtpPort, secure: config.smtpSecure, auth: { user: config.smtpUser, pass: config.smtpPassword } })` (research.md §1) and calls `.sendMail({ from: config.smtpFrom, to, subject, text: body })`, letting any thrown error propagate to the caller unchanged (to be wrapped as `delivery_failed` by the tool)
- [X] T011 [US1] In `frontend/lib/mcp-tools/messagingTools.ts` (T009), register the `send_email` tool: zod input schema `{ to: z.array(z.string()).min(1).max(50), subject: z.string(), body: z.string() }`. On call: reject with whole-call `invalid_message` (via `messagingErrorResult`) if `subject`/`body` is empty; call `readMessagingConfig()` + `validateEmailConfig()` (T006), returning whole-call `missing_config` if invalid; call `checkAndRecordSend()` (T007) once per call (not per recipient), returning whole-call `rate_limited` if it throws; then, for each address in `to`, validate with `isValidEmailAddress()` (T004) — on failure, call `recordSendAttempt()` (T008) with `status: "failure", errorCode: "invalid_recipient"` and skip sending; on success, call `sendEmailToRecipient()` (T010), catching any error to record/report `delivery_failed` and otherwise recording/reporting `"success"` — return `{ results: [...] }` per contracts/mcp-tools-messaging.md `send_email`, using `ok()` (`frontend/lib/mcp-tools/result.ts`) to wrap the final response — depends on T009, T010

### Validation for User Story 1

- [ ] T012 [US1] Run quickstart.md Scenarios 1-4 against a running `next dev` instance with a real or disposable SMTP account (e.g. Mailtrap/Ethereal), confirming: successful delivery within ~5s (Scenario 1); `invalid_recipient` with no SMTP connection attempted (Scenario 2); mixed valid/invalid recipients producing independent per-address results while the valid one still gets delivered (Scenario 3); a distinguishable `missing_config`/`delivery_failed` error when SMTP is misconfigured (Scenario 4)

**Checkpoint**: User Story 1 fully functional and independently testable — MVP deliverable

---

## Phase 4: User Story 2 - Send a Telegram message (Priority: P1)

**Goal**: `send_telegram_message` delivers a message via the configured Telegram bot given `chatId`/`text`, rejecting empty or oversized text before attempting delivery, respecting the shared rate limit, and recording every attempt.

**Independent Test**: Call `send_telegram_message` with a valid chat and confirm delivery within ~3s (quickstart.md Scenario 5); call it against a chat the bot cannot reach and confirm a clear failure (Scenario 6); call it with oversized text and confirm rejection before any Telegram API call (Scenario 7).

### Implementation for User Story 2

- [X] T013 [P] [US2] Create `frontend/lib/messaging/telegram.ts` exporting `sendTelegramMessage(chatId: string, text: string, config: MessagingConfig): Promise<void>` that calls `fetch(\`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage\`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text }) })` (research.md §2), throwing a `MessagingError` with code `"unauthorized"` when the Telegram API responds with `ok: false` and `error_code` `400`/`403` (bot not a member / blocked / chat not found), or `"delivery_failed"` for any other non-`ok` response or network failure
- [X] T014 [US2] In `frontend/lib/mcp-tools/messagingTools.ts` (T009), register the `send_telegram_message` tool: zod input schema `{ chatId: z.string().min(1), text: z.string().min(1).max(4096) }`. On call: reject with `invalid_message` (via `messagingErrorResult`) if `text` fails `isValidMessageLength(text, 4096)` (T004); call `readMessagingConfig()` + `validateTelegramConfig()` (T006), returning `missing_config` if invalid; call `checkAndRecordSend()` (T007), returning `rate_limited` if it throws; call `sendTelegramMessage()` (T013), recording the outcome via `recordSendAttempt()` (T008) either way; return `{ chatId, status: "success" }` via `ok()` on success, or the appropriate error via `messagingErrorResult()` on failure, per contracts/mcp-tools-messaging.md `send_telegram_message` — depends on T009, T013

### Validation for User Story 2

- [ ] T015 [US2] Run quickstart.md Scenarios 5-7 against a running `next dev` instance with a real Telegram bot already added to a test chat, confirming: successful delivery within ~3s (Scenario 5); an `unauthorized`/`delivery_failed` result for a chat the bot cannot reach (Scenario 6); `invalid_message` rejection of oversized text with no Telegram API call made (Scenario 7)

**Checkpoint**: User Stories 1 AND 2 (the full P1 MVP) both work independently

---

## Phase 5: User Story 3 - See why a send attempt failed (Priority: P2)

**Goal**: Confirm every send attempt from either tool — success or failure — is durably recorded and retrievable, and that the rate limit (Foundational T007) is genuinely shared across both tools, not per-tool. Delivered as a side effect of T008/T011/T014's `recordSendAttempt()` calls; this phase is validation-only.

**Independent Test**: Trigger a known failure on each tool and confirm the outcome and reason are recorded (quickstart.md Scenario 9); exhaust the rate limit via one tool and confirm the other tool is blocked too (Scenario 8).

### Validation for User Story 3

- [ ] T016 [US3] Run quickstart.md Scenario 8: temporarily set `MESSAGING_RATE_LIMIT_MAX=2`, restart `next dev`, call `send_email` twice successfully then `send_telegram_message` once, and confirm the third call — regardless of tool — is rejected with `rate_limited` with no message delivered; then restore the original rate-limit values and restart
- [ ] T017 [US3] Run quickstart.md Scenario 9: after Scenarios 1-8 have run, inspect the records under `.messaging/send-log/` in the configured bucket and confirm each has `channel`, `destination`, `timestamp`, `status`, and — for failures — a non-null `errorCode`/`errorMessage`

**Checkpoint**: All three user stories independently functional — both tools work, and their combined activity is observable and rate-limited as one shared surface

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Non-blocking improvements that don't gate any user story

- [X] T018 [P] Add a non-fatal startup warning for missing/invalid SMTP or Telegram configuration to `frontend/instrumentation.ts`'s `register()`, calling `validateEmailConfig()`/`validateTelegramConfig()` (T006) inside try/catch blocks and logging via `console.error` without throwing/exiting, mirroring the existing OAuth-owner-credential warning already in that file (research.md §7)
- [ ] T019 [P] Run quickstart.md Scenario 10: call `send_telegram_message` twice in immediate succession with identical `{ chatId, text }` and confirm both calls succeed independently with no deduplication

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup (T001, for `nodemailer` to exist before T010 uses it) — BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - US1 (Phase 3) and US2 (Phase 4) are independent of each other and can proceed in parallel
  - US3 (Phase 5) depends on both US1 and US2 already being implemented — it validates their combined behavior rather than adding new code
- **Polish (Phase 6)**: Depends on all three user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Depends only on Foundational (T003-T009) — touches `frontend/lib/messaging/email.ts` (new file) and the `send_email` registration inside `messagingTools.ts`
- **User Story 2 (P1)**: Depends only on Foundational (T003-T009) — touches `frontend/lib/messaging/telegram.ts` (new file) and the `send_telegram_message` registration inside `messagingTools.ts`; both stories edit `messagingTools.ts`, so T011 and T014 are not parallel with each other even though the rest of each story is independent
- **User Story 3 (P2)**: Depends on User Story 1 (T011) and User Story 2 (T014) already being implemented — it validates their combined behavior (shared rate limit, shared audit log)

### Within Each User Story

- Domain logic (`email.ts`/`telegram.ts`) before tool registration
- Tool registration before validation
- Story complete before moving to the next phase's validation-only work (US3)

### Parallel Opportunities

- T001 and T002 (Setup) can run in parallel
- T003, T004, T005, T008 (Foundational) can run in parallel — different files, no dependencies on each other
- T006 depends on T003; T007 depends on T003, T005, T006; T009 depends on T003 — these must follow their dependencies
- Once Foundational completes, US1's T010 and US2's T013 can run in parallel (different files); T011 and T014 both edit `messagingTools.ts` and should be done one after the other (in either order)

---

## Parallel Example: Foundational Phase

```bash
# Launch independent Foundational tasks together:
Task: "Create frontend/lib/messaging/errors.ts (T003)"
Task: "Create frontend/lib/messaging/validation.ts (T004)"
Task: "Create frontend/lib/messaging/store.ts (T005)"
Task: "Create frontend/lib/messaging/auditLog.ts (T008)"
```

## Parallel Example: User Story 1 + User Story 2

```bash
# Once Foundational is complete, domain logic for both stories can proceed together:
Task: "Create frontend/lib/messaging/email.ts (T010)"
Task: "Create frontend/lib/messaging/telegram.ts (T013)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks both stories)
3. Complete Phase 3: User Story 1 (`send_email`)
4. **STOP and VALIDATE**: Run quickstart.md Scenarios 1-4 independently
5. Deploy/demo if ready — `send_email` alone is already a usable increment

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 (`send_email`) → validate → deploy/demo (MVP!)
3. Add User Story 2 (`send_telegram_message`) → validate → deploy/demo
4. Add User Story 3 (observability/rate-limit-sharing validation) → validate → deploy/demo
5. Polish (startup warning, duplicate-send confirmation)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Both `send_email` and `send_telegram_message` are registered in the same `messagingTools.ts` file — real (not just nominal) parallelism between US1 and US2 stops at T011/T014; everything else in each story is independent
- No automated tests exist in this project; every "Validation" task above is a manual quickstart.md walkthrough, not a test task
