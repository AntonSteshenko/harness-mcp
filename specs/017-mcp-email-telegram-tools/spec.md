# Feature Specification: MCP Email & Telegram Messaging Tools

**Feature Branch**: `017-mcp-email-telegram-tools`

**Created**: 2026-07-27

**Status**: Draft

**Input**: User description: "vorrei aggiungere a mcp due tools: send email (SMTP) e send message Telegram"

## Clarifications

### Session 2026-07-27

- Q: Should the system enforce a rate limit / send-volume cap to prevent runaway or abusive usage? → A: Enforce a fixed rate limit (e.g., max N messages per minute/hour) shared across both tools, configurable by the administrator.
- Q: What is the maximum number of recipients allowed in a single email send call? → A: Cap at 50 recipients per call.
- Q: Should identical messages sent to the same destination in quick succession be deduplicated? → A: No deduplication — every call is sent as requested; avoiding accidental duplicates is the caller's responsibility.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Send an email notification (Priority: P1)

An agent acting on behalf of the business needs to reach someone who does not actively monitor the system (a client, supplier, or teammate) by sending them an email with a subject and message body.

**Why this priority**: Email is the most universal channel for reaching people outside the immediate team, and many existing workflows (reports, reminders, confirmations) depend on it. Without it, the agent cannot close the loop with external parties.

**Independent Test**: Can be fully tested by invoking the email tool with a valid recipient address, subject, and body, and confirming the message is delivered to that recipient's inbox.

**Acceptance Scenarios**:

1. **Given** a valid recipient address, subject, and body, **When** the agent sends the email, **Then** the message is delivered via the configured mail account and the tool reports success.
2. **Given** an invalid or malformed recipient address, **When** the agent attempts to send, **Then** the tool rejects the request and returns a clear reason without contacting the mail server.
3. **Given** the mail server is unreachable or rejects the configured credentials, **When** the agent attempts to send, **Then** the tool reports a clear failure reason distinguishing it from an invalid-recipient error.

---

### User Story 2 - Send a Telegram message (Priority: P1)

An agent needs to post a time-sensitive message (an alert, status update, or short notice) into a Telegram chat or channel that the team actively watches.

**Why this priority**: Telegram is used for messages that need fast visibility, complementing email for less time-sensitive communication. Both channels are needed to cover the range of notification use cases the business relies on.

**Independent Test**: Can be fully tested by invoking the Telegram tool with a configured chat identifier and message text, and confirming the message appears in that chat.

**Acceptance Scenarios**:

1. **Given** a valid target chat identifier and message text, **When** the agent sends the message, **Then** it appears in the target chat and the tool reports success.
2. **Given** a chat identifier the configured bot cannot reach (bot not a member, chat does not exist, bot was blocked), **When** the agent attempts to send, **Then** the tool reports a clear failure reason.
3. **Given** message text longer than the platform's allowed length, **When** the agent attempts to send, **Then** the tool rejects the request with a clear reason before calling the Telegram API.

---

### User Story 3 - See why a send attempt failed (Priority: P2)

Whoever is reviewing agent activity needs to understand, after the fact, whether a given email or Telegram message actually went out, and if not, why.

**Why this priority**: Silent failures erode trust in automated notifications; this story is what makes stories 1 and 2 trustworthy in production rather than "fire and forget."

**Independent Test**: Can be tested by triggering a known failure (bad recipient, unreachable server, unauthorized bot) and confirming the outcome and reason are recorded and retrievable, independent of whether the send itself succeeds.

**Acceptance Scenarios**:

1. **Given** any send attempt (email or Telegram), **When** it completes, **Then** the outcome (success or failure) and a timestamp are recorded.
2. **Given** a failed send attempt, **When** the record is reviewed, **Then** it includes a human-readable reason for the failure.

---

### Edge Cases

- What happens when the email body or Telegram message text is empty?
- What happens when required sending configuration (mail account or Telegram bot token) has not been set up yet?
- How does the system handle transient network failures — does it retry, or fail immediately and let the caller decide?
- What happens when the recipient list for an email includes a mix of valid and invalid addresses?
- When the same message is sent twice in quick succession (accidental duplicate calls), both are sent — the system performs no deduplication; the caller is responsible for avoiding unintended repeats.
- How does the system handle non-ASCII / emoji content in either channel?
- When a caller exceeds the configured rate limit, the request is rejected outright with a clear error (not queued or silently dropped).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a tool that sends an email via SMTP given a recipient address, subject, and body.
- **FR-002**: System MUST provide a tool that sends a text message via Telegram given message text and, optionally, a target chat/channel identifier — falling back to an administrator-configured default chat when the caller omits one (clarified post-implementation 2026-07-27).
- **FR-003**: System MUST validate the recipient email address and reject the request with a clear error before attempting delivery if it is malformed.
- **FR-004**: System MUST validate that message text is non-empty and within the destination channel's size limits, rejecting oversized or empty content with a clear error before attempting delivery.
- **FR-005**: System MUST use sending credentials (SMTP account, Telegram bot token) configured in advance by the system administrator; callers of the tools MUST NOT need to supply credentials per call.
- **FR-006**: System MUST report, for every send attempt, whether it succeeded or failed, and MUST include a human-readable reason when it fails.
- **FR-007**: System MUST distinguish, in its failure reporting, between input validation errors (bad recipient, empty message), configuration errors (missing/invalid credentials), and delivery errors (server unreachable, rejected by provider).
- **FR-008**: System MUST record each send attempt (channel, destination, timestamp, outcome, and failure reason if any) so it can be reviewed later.
- **FR-009**: System MUST support a plain-text email body at minimum; basic HTML-formatted bodies MAY also be supported.
- **FR-010**: System MUST allow the email tool to accept multiple recipients (up to 50) in a single call, reporting per-recipient outcome when some addresses are invalid and others are not, and MUST reject the call outright with a clear error if the recipient count exceeds 50.
- **FR-011**: System MUST enforce an administrator-configurable rate limit on the number of messages sent per unit of time, shared across both tools, and MUST reject requests that would exceed it with a clear, distinguishable error.

### Key Entities

- **Email Message**: A single outbound email — recipient address(es), subject, body, and the configured sender identity it was sent from.
- **Telegram Message**: A single outbound Telegram message — target chat/channel identifier and message text.
- **Send Attempt Record**: The outcome of one call to either tool — channel (email/Telegram), destination, timestamp, success/failure status, and failure reason when applicable.
- **Messaging Configuration**: The administrator-provisioned settings each tool depends on — SMTP account details for email, bot token for Telegram — set up once per deployment rather than per call.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An agent can successfully send an email to a valid recipient, with the tool confirming delivery to the mail server, in under 5 seconds under normal network conditions.
- **SC-002**: An agent can successfully deliver a Telegram message to a configured chat, with the tool confirming acceptance by the Telegram API, in under 3 seconds under normal network conditions.
- **SC-003**: 100% of failed send attempts return a reason specific enough to tell the caller whether the problem was their input, the configuration, or the destination/provider.
- **SC-004**: An administrator can set up or change the sending accounts (mail account, Telegram bot) through configuration alone, with no code changes required.
- **SC-005**: Every send attempt, successful or not, is retrievable afterward for review.

## Assumptions

- A single pre-configured mail account and a single pre-configured Telegram bot are provisioned per deployment by the system administrator; the tools do not manage multiple sender identities or per-call credentials.
- Email attachments and rich HTML templating are out of scope for this feature; plain-text bodies (with optional basic HTML) are sufficient for v1.
- The Telegram bot is already added to any target chats/channels before these tools are used; the tools do not handle bot invitation or chat discovery.
- Access control over which agents/workflows are permitted to invoke these tools is handled outside this feature (at the layer that authorizes tool use), not by the tools themselves.
- "Delivered" means the message was accepted by the SMTP server or the Telegram API, not that a human has read it.
- Retry behavior on transient failures is left to the caller (the tools fail fast and report a clear reason rather than silently retrying).
- An administrator MAY configure one default Telegram chat (`telegramChatId`) that `send_telegram_message` uses when a call omits `chatId`; this is optional — a deployment with no default configured simply requires the caller to always pass `chatId`.
