# Feature Specification: Multilingual Company OS Setup

**Feature Branch**: `015-multilingual-support`

**Created**: 2026-07-25

**Status**: Draft

**Input**: User description: "il sistema deve essere multilinguale, per ora inglese, italiano, russo, francese, tedesco, spagnolo. Deve prendere la lingua dal browser ma al init chiedere se la lingua e questa. Tutto il contenuto poi deve essere in questa lingua (anche skill e tutto os). I nomi delle cartelle in os pero devono essere semre uguali in inglese, ma data nella lingua scelta."

## Clarifications

### Session 2026-07-25

- Q: Once a language is confirmed at first-time setup, can it be changed later (e.g. from a settings page), or is it a one-time, permanent choice for the life of that Company OS? → A: One-time, permanent choice. The system does not offer a way to change it later; a different language would require starting a new Company OS.
- Q: Should a Company OS that was already initialized before this feature exists be able to adopt the new multilingual system, or does this feature only apply to new installations created from now on? → A: New installations only. Already-initialized Company OS instances are left exactly as they are today; the language confirmation step only happens on a fresh, empty-bucket setup.
- Q: What language do pages render in before any Company OS has a confirmed language (the "storage not connected" helper, and the empty-bucket setup page itself before the visitor has confirmed)? → A: These pages also use live, per-request browser-detected language (not persisted) — the same six languages, just not yet "confirmed."
- Q: Does "every page renders in the confirmed language" (FR-008) also cover machine-facing responses aimed at connected AI assistants/API clients (MCP tool descriptions/errors, OAuth JSON error bodies), or only the human-facing UI? → A: Human-facing UI pages only. MCP tool descriptions/errors and OAuth machine-readable responses stay in English regardless of the confirmed language.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Confirming the setup language on a fresh Company OS (Priority: P1)

A first-time visitor, whose storage is connected but empty (no `/os` or `/data` yet), opens the setup page. Instead of immediately offering the single "create it" confirmation, the system detects the language the visitor's browser is set to, tells them which of the six supported languages it matched, and asks them to confirm it or pick a different one from the list. Only after a language is confirmed does the system create the Company OS skeleton — written in that language.

**Why this priority**: This is the moment that fixes the language for the rest of that Company OS's life. Getting it right here is the entire point of the feature; everything else (User Story 2 and 3) is a consequence of this choice.

**Independent Test**: Point the app at a freshly connected, empty bucket with the browser set to each of the six supported languages in turn, confirm the suggested language, and verify the resulting `AGENTS.md` and `os/skills/init.md` are written in that language, with no OS content created before confirmation.

**Acceptance Scenarios**:

1. **Given** storage is connected and empty, **When** the visitor opens the setup page, **Then** the system shows the browser-detected language (one of English, Italian, Russian, French, German, Spanish) and asks the visitor to confirm it or choose a different one from the same six, before showing the creation action.
2. **Given** the visitor's browser is set to a language outside the six supported ones, **When** the setup page loads, **Then** the system pre-selects English as the suggestion but still lets the visitor pick any of the six.
3. **Given** the visitor confirms a language (whether the suggested one or a different one they picked), **When** they proceed with creation, **Then** the system creates `/os` and `/data`, and writes `/AGENTS.md` and `/os/skills/init.md` in the confirmed language, and stores the confirmed language as part of the Company OS itself.
4. **Given** no language has been confirmed yet, **When** the visitor has not completed the confirmation step, **Then** the system creates no OS content.

---

### User Story 2 - The whole application follows the confirmed language (Priority: P2)

Once a Company OS has a confirmed language, anyone who opens the application afterward — the owner, a teammate, on any device or browser — sees every page (setup, editor, sign-in and connection screens, settings, confirmations, error messages) in that same language, regardless of what language their own browser happens to be set to.

**Why this priority**: A Company OS is shared, multi-visitor storage; if the interface language depended on each visitor's own browser, the same company would look inconsistent to different people and the confirmed language from User Story 1 would only ever affect the setup step. This is what makes the choice actually mean something app-wide.

**Independent Test**: Confirm a language other than the tester's own browser language during setup, then reload the application in a browser set to a different language, and verify every page still renders in the confirmed language, not the browser's.

**Acceptance Scenarios**:

1. **Given** a Company OS has a confirmed language, **When** any visitor opens any page of the application, **Then** the page's text renders in the confirmed language regardless of that visitor's own browser language.
2. **Given** a Company OS has no confirmed language (created before this feature existed), **When** any visitor opens the application, **Then** the application falls back to a single fixed default language rather than detecting or asking.

---

### User Story 3 - Company OS content stays in the confirmed language, folder names stay in English (Priority: P3)

As the connected AI assistant later interviews the owner and writes the rest of the Company OS (identity, pricing and delivery policies, communication style, day-to-day skills, client and project records, and so on), everything it writes reads in the confirmed language — but every folder and file name it creates is the same fixed English name the system would use no matter which of the six languages was confirmed.

**Why this priority**: This is what makes the feature trustworthy for automation and for people who don't read the confirmed language: the shape of the Company OS is predictable and identical across languages, even though its content is not. It depends on User Story 1 having already fixed a language, so it is lower priority than the confirmation step itself.

**Independent Test**: Initialize two Company OS instances from an empty bucket, one confirming English and one confirming a different one of the six languages, run the same setup interview against both, and verify the two resulting directory/file trees have identical names while the file contents differ only in language.

**Acceptance Scenarios**:

1. **Given** a Company OS was set up with a non-English confirmed language, **When** the connected AI assistant creates further folders and files (skills, policies, templates, client and project records), **Then** every folder and file name matches the fixed English name used for that same purpose in an English-confirmed Company OS.
2. **Given** a Company OS was set up with a non-English confirmed language, **When** the connected AI assistant writes the content of any file, **Then** that content is written in the confirmed language.

### Edge Cases

- What happens when the browser reports a language the system doesn't yet support (e.g. Portuguese, Japanese)? The suggestion defaults to English, but the visitor can still pick any of the six before anything is created.
- What happens when a visitor rejects the suggested language and picks a different one? The system uses the picked language, not the detected one, for everything from that point on.
- What happens when storage isn't connected yet? There is no Company OS to store a language in yet, so the language confirmation step is deferred until the visitor actually reaches the empty-bucket creation step; it does not appear on the "storage not connected" helper screen. That screen (and the empty-bucket setup page itself, before the visitor confirms) still renders in the visitor's own browser-detected language (one of the six, defaulting to English if unmatched) — it is just not yet a permanent, persisted choice.
- What happens if two people open the empty-bucket setup page at the same time with different browser languages, and both try to confirm? Only one language confirmation may take effect; the existing double-submit protection that prevents creating the skeleton twice also prevents a second, conflicting language from being applied.
- What happens on a Company OS that already existed before this feature shipped? Nothing about it changes — no language confirmation step appears for it, and its existing content and structure are left exactly as they are.
- What happens if the visitor closes or abandons the page after seeing the language suggestion but before confirming? No OS content is created; the next visit starts the same confirmation step over again.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support exactly six languages at launch: English, Italian, Russian, French, German, and Spanish.
- **FR-002**: System MUST automatically detect the visitor's browser-preferred language when the visitor reaches the empty-bucket setup step (no `/os` or `/data` yet).
- **FR-003**: System MUST map the detected browser language to the closest matching one of the six supported languages; if none matches, it MUST default the suggestion to English.
- **FR-004**: System MUST present the suggested language to the visitor and let them either confirm it or choose a different one of the six before any Company OS content is created.
- **FR-005**: System MUST NOT create `/os`, `/data`, or any file within them until a language has been confirmed.
- **FR-006**: Once confirmed, system MUST persist the chosen language as part of the Company OS itself (not only in the confirming visitor's own browser), so that every later visitor and any connected AI assistant reads the same value.
- **FR-007**: The confirmed language MUST be permanent for the life of that Company OS: the system MUST NOT re-ask on later visits and MUST NOT offer a way to change it afterward.
- **FR-008**: Once a Company OS has a confirmed language, every human-facing page of the application (setup, editor, sign-in/connection screens, settings, confirmations, error messages) MUST render in that language for every visitor, independent of that visitor's own browser language. Machine-facing responses aimed at connected AI assistants or API clients (e.g. MCP tool descriptions and errors, OAuth machine-readable responses) are out of scope and remain in English regardless of the confirmed language.
- **FR-009**: The router file (`AGENTS.md`) and the bundled init skill (`os/skills/init.md`) that the system writes during setup MUST be written in the confirmed language, carrying the same meaning and instructions as the English version.
- **FR-010**: The localized init skill MUST instruct any connected AI assistant to write all further Company OS content it generates (identity, policies, other skills, data records) in the confirmed language.
- **FR-011**: Regardless of which of the six languages is confirmed, every directory and file name created inside the Company OS (by the system or by the connected AI assistant following the init skill) MUST be the same fixed English name used when English is confirmed — only the prose content inside files varies by language.
- **FR-012**: This language-confirmation step MUST apply only to a Company OS being set up from an empty bucket from this point forward; a Company OS already initialized before this feature exists MUST be left unaffected.
- **FR-013**: When the application cannot find a stored language setting for a Company OS (because it was initialized before this feature existed), it MUST fall back to a single fixed default language for its own UI rather than detecting, asking, or erroring.
- **FR-014**: Any page shown before a Company OS has a confirmed language (the "storage not connected" helper, and the empty-bucket setup page prior to confirmation) MUST render using the visitor's own live, per-request browser-detected language (one of the six, defaulting to English if unmatched), without persisting that as the Company OS's language.

### Key Entities

- **System Language**: the single, permanent language recorded once per Company OS during its fresh setup; read on every later request to decide both the application UI's language and the language the connected AI assistant is instructed to write new content in.
- **Supported Language**: one of the six offered languages (English, Italian, Russian, French, German, Spanish), each with its own translated application UI text and its own localized version of the router file and init skill.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time visitor whose browser is set to any of the six supported languages reaches a fully translated setup confirmation, application UI, and generated skeleton content in that language, with no manual translation step required.
- **SC-002**: Across all six supported languages, the setup confirmation and the resulting Company OS skeleton show no untranslated placeholder or fallback text.
- **SC-003**: After a language is confirmed, 100% of subsequent visits to the application — regardless of the visitor's own browser language — render in the confirmed language.
- **SC-004**: For any two Company OS instances set up with different confirmed languages, the set of directory and file names each produces for the same setup interview is identical.
- **SC-005**: A visitor whose browser language is not one of the six still completes setup without being blocked, landing on a working English-defaulted suggestion that can be overridden with any of the six.

## Assumptions

- "The OS" refers to the Company OS bootstrapped by the existing setup page: its router file, its bundled init skill, and everything that file and any connected AI assistant subsequently create in storage.
- Browser language detection uses the standard browser-reported language signal (e.g. the browser's language header/setting) available at the unauthenticated setup step; no separate account or profile-based language source exists at that point.
- The six languages need static, pre-translated versions of only two things: the application's own UI text, and the two bundled skeleton files written at setup (router file and init skill). The many further documents an AI assistant writes later (identity, pricing, delivery, communication style, day-to-day skills, client/project records, etc.) are not separately pre-translated — they inherit the confirmed language because the localized init skill instructs the assistant to write in it.
- Some skill/file names described in the current init skill instructions are not yet in English; bringing every such name to a fixed English equivalent is in scope, since folder and file names must stay English regardless of the confirmed language.
- No language switcher or re-initialization workflow is introduced; changing a Company OS's language after the fact is out of scope and would require setting up a new Company OS from an empty bucket.
- A Company OS that already exists today keeps working exactly as it does now; the application defaults its own UI to English when it finds no stored language setting, without altering that OS's existing content or structure.
