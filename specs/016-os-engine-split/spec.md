# Feature Specification: Split the OS Engine From Business Bootstrap, With Versioned Upgrades

**Feature Branch**: `016-os-engine-split`

**Created**: 2026-07-27

**Status**: Draft

**Input**: User description: "Split the Company OS 'init' skill into an MCP-only engine and a separate business-bootstrap skill, with version tracking and an upgrade flow."

## Clarifications

### Session 2026-07-27

- Q: When repair encounters an `AGENTS.md` whose recorded engine version is behind the current one, does it silently rebuild on the latest version, preserve the old version, or show the same change description as an explicit upgrade check before proceeding? → A: Repair shows the same "what would change" description as an explicit upgrade check whenever the recorded version is behind current, and proceeds only after confirmation — repair and upgrade share one confirmation gate, not two independent paths.
- Q: How often is "does business data exist" checked to decide whether to trigger business setup — every task, only specific app-level entry points, or once per connection session? → A: Every task, as part of the assistant's normal first read of `AGENTS.md`/routing at the start of each task — the same cadence as today's "first read of every task" rule, not a separate app-level-only or once-per-session check.
- Q: When `AGENTS.md` is behind by more than one engine version, does the upgrade/repair change description list every skipped version individually, summarize the net difference only, or show only the latest version's changelog? → A: A summarized net difference between the recorded version and the current one — no per-version history, no silent omission of what changed.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - AGENTS.md is built and repaired by a non-editable engine (Priority: P1)

Today, an owner (or an over-eager connected assistant) can hand-edit `os/skills/init.md` in the bucket, silently drifting away from the product-provided rules with no way to notice. Going forward, the rules that govern how `AGENTS.md` gets built or repaired live only in the MCP server itself — never as a bucket file — so they can't be hand-corrupted. A connected assistant asked to "init", "initialize", "repair", or "start over" on the Company OS reaches for this engine to (re)build `AGENTS.md`, and `AGENTS.md` itself records which engine version it was built from.

**Why this priority**: This is the foundation everything else in this feature depends on — without a non-editable, versioned engine, there is nothing to detect drift against and nothing for the upgrade flow to compare.

**Independent Test**: Can be fully tested by connecting an assistant to a fresh bucket, asking it to build the OS's control file, and verifying `AGENTS.md` is created with a recorded engine version — without any `init.md`-equivalent file appearing anywhere in the bucket.

**Acceptance Scenarios**:

1. **Given** an empty bucket, **When** the owner asks a connected assistant to set up the Company OS, **Then** `AGENTS.md` is created in the bucket recording the engine version it was built from, and no engine rules file is written anywhere in the bucket.
2. **Given** an existing Company OS whose `AGENTS.md` has been damaged or partially deleted, **When** the owner asks the assistant to repair it, **Then** the assistant rebuilds `AGENTS.md` using the engine, without needing any bucket-stored copy of the engine's own rules.
3. **Given** a connected assistant with no special instruction, **When** it inspects the bucket, **Then** it cannot find or open an editable "engine rules" file to hand-modify — the rules are only reachable through the assistant's connection to the OS provider, not through the file tree.
4. **Given** an `AGENTS.md` whose recorded engine version is older than the engine's current version, **When** the owner asks for a repair (not an explicit upgrade), **Then** the assistant shows the same change description a direct upgrade check would show and proceeds only after the owner confirms — repair never silently carries a version change.
5. **Given** an `AGENTS.md` whose recorded engine version already matches the current one, **When** the owner asks for a repair, **Then** the assistant rebuilds it directly with no change description or confirmation step, since nothing about the version is changing.

---

### User Story 2 - Owner is offered an upgrade when the engine has moved on (Priority: P1)

An owner's Company OS was built months ago against an older set of engine rules. The product has since improved those rules. Today nothing tells the owner this happened — the OS just quietly keeps running on stale behavior forever. Now, the owner can explicitly ask to check for an upgrade, and if the OS provider's engine has moved past what `AGENTS.md` was built with, the connected assistant explains — in the owner's own confirmed language — what would change and asks for confirmation before rebuilding `AGENTS.md`.

**Why this priority**: Without this, versioning is inert bookkeeping. This is the payoff — it's what makes drift visible and fixable instead of silent.

**Independent Test**: Can be fully tested by manually setting `AGENTS.md`'s recorded engine version behind the current one, asking the assistant to check for an upgrade, and confirming it describes the change and only rebuilds `AGENTS.md` after the owner agrees.

**Acceptance Scenarios**:

1. **Given** an `AGENTS.md` recording an older engine version than what the OS provider currently offers, **When** the owner asks to check for an OS upgrade, **Then** the assistant describes what would change, in the owner's confirmed language, and asks for confirmation before touching anything.
2. **Given** the owner confirms the upgrade, **When** the assistant proceeds, **Then** `AGENTS.md` is rebuilt to reflect the current engine and its recorded version is updated to match.
3. **Given** the owner declines the upgrade, **When** the assistant proceeds, **Then** nothing in the bucket is modified, and the same offer is available again next time the owner asks.
4. **Given** an `AGENTS.md` already recording the current engine version, **When** the owner asks to check for an upgrade, **Then** the assistant reports there is nothing new — no changes are made.

---

### User Story 3 - Pre-existing Company OS instances are picked up without data loss (Priority: P2)

Some Company OS instances were created before this feature existed — their `AGENTS.md` has no recorded engine version at all, and their routing information (which skill handles which kind of task) is embedded directly inside `AGENTS.md`'s text rather than kept separately. The first time such an owner asks for a repair or an upgrade check, the assistant recognizes this as the oldest possible state, pulls the existing routing information out of the old `AGENTS.md` before rebuilding it, and preserves it in its new, separate location rather than discarding it.

**Why this priority**: Protects existing users from data loss the moment this feature ships. Lower priority than Stories 1-2 because it's a one-time transitional path, not everyday behavior, but it must exist before this feature can safely go out to instances created under the old system.

**Independent Test**: Can be fully tested by taking a bucket built under the old, single-file system (routing embedded in `AGENTS.md`, no recorded engine version), asking the assistant to repair or upgrade it, and confirming the previously-embedded routing entries reappear intact in their new location afterward.

**Acceptance Scenarios**:

1. **Given** an `AGENTS.md` with no recorded engine version and routing information embedded in its text, **When** the owner asks for a repair or upgrade, **Then** the assistant treats this as the oldest possible state and does not silently overwrite it without first extracting the embedded routing information.
2. **Given** that extraction has happened, **When** the assistant finishes rebuilding, **Then** every routing entry that existed in the old `AGENTS.md` is present in the new, separate routing file, and none are lost.
3. **Given** the owner has never asked for a repair or upgrade, **When** they use their Company OS normally for any other task, **Then** nothing about their existing setup changes and no upgrade is forced on them.

---

### User Story 4 - Business setup and routing live apart from the engine (Priority: P2)

Right now, one and the same file both governs low-level Company OS mechanics (how files get written, the "never overwrite blindly" rules) and runs the actual business interview that builds out `data/`, the owner's identity, policies, and domain-specific skills. Under this feature, the business interview and everything it produces (the `data/` structure, `os/identity.md`, policies, domain skills, and the routing table listing which skill handles which task) is the responsibility of a separate flow from the engine that maintains `AGENTS.md`. This flow triggers itself when the OS notices its business data is missing or incomplete, asks the owner the same questions as before, and keeps the routing table as its own file the owner (or assistant) can edit afterward without needing to touch `AGENTS.md` at all.

**Why this priority**: Necessary for the split to be coherent (the engine can't stay "pure" if it's still running the interview), but the observable owner experience — being interviewed once to stand up a business-specific OS — barely changes from what exists today, so it's lower urgency than the drift-prevention stories above.

**Independent Test**: Can be fully tested by connecting an assistant to a bucket that already has a valid `AGENTS.md` but no business data, confirming the business-setup flow triggers on its own, runs the interview, and produces `data/`, identity, policies, domain skills, and a routing file that's editable on its own afterward.

**Acceptance Scenarios**:

1. **Given** a bucket with a valid `AGENTS.md` but no `data/` content, **When** the owner starts any Company OS task, **Then** the assistant recognizes the business setup hasn't happened and offers to run the interview before anything else.
2. **Given** the owner completes the interview, **When** the assistant finishes, **Then** `data/`, the owner's identity, applicable policies, applicable domain skills, and the routing table all exist and reflect the interview's answers, with no placeholder content invented on the owner's behalf.
3. **Given** a Company OS that already has business data, **When** the owner or an assistant adds or removes a skill later, **Then** only the routing file needs to change to reflect it — `AGENTS.md` itself is untouched.

### Edge Cases

- What happens if the owner asks to check for an upgrade while offline from the OS provider (the engine's current version can't be reached)? The assistant should report it cannot check right now rather than guessing or silently skipping the check.
- What happens if a repair is requested while offline from the OS provider, and the recorded version can't be compared against the current one? The assistant should report it cannot safely repair right now rather than guessing whether a version change would occur.
- What happens if the business-setup interview is interrupted partway (owner answers some questions, then the connection drops)? Nothing partial should be written — the existing "interview first, writing after" rule (no writes before all answers are in) already covers this and continues to apply.
- What happens if an owner manually edits the routing file to reference a skill that doesn't exist, or removes an entry for one that does? Out of scope for this feature to reconcile automatically (see Assumptions) — the assistant follows the routing file as given.
- What happens when the confirmed OS language (from the existing multilingual feature) is missing entirely (a pre-multilingual, pre-this-feature OS)? The upgrade/repair flow falls back to English for its own explanations, consistent with how the existing language feature already falls back today.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide the rules for building and repairing `AGENTS.md` exclusively through the OS provider's connection (never as a file written into the bucket), so they cannot be viewed or edited as a normal bucket file.
- **FR-002**: The system MUST record, inside `AGENTS.md` itself, which version of the engine rules it was last built or repaired against.
- **FR-003**: The system MUST let an owner explicitly request an upgrade check at any time.
- **FR-004**: When an upgrade check finds the engine has moved past `AGENTS.md`'s recorded version, the system MUST describe what would change, in the owner's confirmed language (falling back to English if no language has been confirmed), before making any change. If more than one engine version has been skipped, the description MUST summarize the net difference between the recorded version and the current one, not a per-version history and not only the latest version's changes.
- **FR-005**: The system MUST NOT modify `AGENTS.md` or any other bucket content as part of an upgrade check unless the owner explicitly confirms.
- **FR-006**: When an upgrade check finds `AGENTS.md` already matches the current engine version, the system MUST report that nothing changed, without touching the bucket.
- **FR-006a**: When a repair would rebuild `AGENTS.md` against an engine version newer than the one it currently records, the system MUST present the same change description and confirmation gate as an explicit upgrade check before proceeding — repair and upgrade share one confirmation step, never two independent paths, and a repair never silently carries a version change.
- **FR-006b**: When a repair's recorded engine version already matches the current one, the system MUST proceed directly with no change description or confirmation step.
- **FR-007**: The system MUST treat an `AGENTS.md` with no recorded engine version as the oldest possible version, not as an error.
- **FR-008**: Before rebuilding an `AGENTS.md` that has no recorded engine version, the system MUST extract any routing information already embedded in its text and preserve it in the routing file, rather than discarding it.
- **FR-009**: The system MUST keep the routing table (which skill handles which kind of task) as its own bucket file, separate from `AGENTS.md`, editable independently of any engine repair or upgrade.
- **FR-010**: The routing file MUST live alongside the other OS control content (not among business records), consistent with the existing rule that only OS control content is ever treated as instructions.
- **FR-011**: The system MUST run the business-setup interview (company info, activity type, who's involved, tone, pricing/product details as applicable, what's out of scope) before writing any business-specific content, and MUST NOT invent answers the owner didn't provide.
- **FR-012**: The system MUST trigger the business-setup flow on its own whenever it detects the OS's business data is missing, without requiring the owner to know a special trigger phrase for it.
- **FR-012a**: The business-data check MUST run as part of the assistant's normal first read of `AGENTS.md`/routing at the start of every task — not only at specific application entry points, and not cached for the remainder of a connection session — so it stays accurate even if business data appears or disappears mid-session.
- **FR-013**: The business-setup flow MUST produce only the business-specific content applicable to the owner's stated activity type (e.g., no empty product backlog for a pure consulting business), matching today's behavior.
- **FR-014**: The system MUST leave a Company OS's existing business data untouched when only an engine repair or upgrade runs — engine changes never rewrite `data/`, identity, policies, or domain skills.
- **FR-015**: Explanations shown to the owner (upgrade descriptions, business-setup prompts and reports) MUST be presented in the OS's confirmed language; the engine's own internal rules are exempt from translation since owners never read them directly.

### Key Entities

- **AGENTS.md**: The Company OS's single router file, living in the bucket. Now additionally records which engine version it was last built from. Produced and repaired by the engine; still readable and inspectable by the owner like any other bucket file.
- **Engine**: The rules for building/repairing `AGENTS.md` — reachable only through the OS provider's connection, never present in the bucket, versioned so drift can be detected.
- **Routing file**: A bucket file, kept alongside other OS control content, listing which skill handles which kind of task. Created and updated by the business-setup flow; edited independently of `AGENTS.md`.
- **Business-setup flow**: The interview-driven process that turns an owner's answers into `data/`, identity, policies, and domain skills. Triggered automatically when business data is missing, not treated as part of the engine.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An owner can determine whether their Company OS is on the latest engine rules without inspecting any file by hand — a single request ("check for an upgrade") gives a clear yes/no answer.
- **SC-002**: Zero routing entries are lost when a pre-existing Company OS (built before this feature) goes through its first repair or upgrade after this feature ships.
- **SC-003**: No engine rules text is ever discoverable as an editable file inside any Company OS bucket, for both newly created and previously existing instances after their first repair/upgrade.
- **SC-004**: An owner can add or remove a skill's routing entry without triggering any change to `AGENTS.md`.
- **SC-005**: A new owner completes business setup (the interview) exactly once per Company OS, with no duplicate or repeated interviews triggered by later unrelated tasks.

## Assumptions

- Reconciling the routing file against what skills actually exist in the bucket (catching stale or missing entries automatically) is out of scope for this feature — the routing file is trusted as given, consistent with today's system, which also doesn't self-heal a hand-edited router.
- "Business data is missing" is judged the same coarse way the existing system already checks OS status today (the `data/` area is absent or empty) — deeper reconciliation against the routing file is out of scope for this feature.
- The naming of the engine's connection points and the business-setup flow's trigger phrasing are implementation details to be settled during planning, not specified here.
- The existing multilingual behavior (owners see content in their confirmed language, falling back to English when none is confirmed) is assumed unchanged and is reused rather than redefined by this feature.
- Existing Company OS instances continue operating exactly as they do today until the owner's first repair or upgrade request touches them — this feature introduces no forced, automatic migration.
