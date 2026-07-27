# Quickstart: Validating the OS Engine Split

**Input**: [spec.md](spec.md), [contracts/mcp-resources.md](contracts/mcp-resources.md), [contracts/init-skeleton.md](contracts/init-skeleton.md)

No automated test suite in this project (consistent with specs 001-015) — validated by manual walkthrough, same as `014-os-init-page`/`015-multilingual-support`'s own quickstarts. Requires local MinIO (spec 001) and an MCP-connected assistant (e.g. this app's `/init` → MCP connect flow, spec 008/013).

## Scenario A — Fresh Company OS, engine builds AGENTS.md (Story 1)

1. Point the app at an empty bucket. Visit `/init`, confirm a language, submit.
2. `AGENTS.md` should now exist as the **stub** described in `contracts/init-skeleton.md` — no `os-engine-version` front matter, no `os/skills/init.md` anywhere in the bucket.
3. Connect an assistant over MCP. Ask it to "initialize the Company OS."
4. Expect: the assistant reaches for the `init` resource, runs the interview, then the `engine` resource to build `AGENTS.md` for real. Confirm afterward: `AGENTS.md` now has `os-engine-version: <current>` in its front matter, points to `os/routing.md` (no inline routing table), and `os/routing.md`/`data/*`/`os/identity.md`/applicable policies and domain skills all exist per the interview's answers.
5. Confirm `resources/list` on the MCP connection shows `engine`, `os-upgrade`, `init` — and confirm none of the three are reachable via `list_directory`/`read_file` (SC-003).

## Scenario B — Upgrade check, nothing new (Story 2, Scenario 4)

1. Using the Company OS from Scenario A (freshly built, `os-engine-version` == current), ask the assistant to "check for an OS upgrade."
2. Expect: it reports nothing has changed, and does not modify `AGENTS.md`.

## Scenario C — Upgrade check, changes available (Story 2, Scenarios 1-3)

1. Temporarily bump `os-engine-version` and add a `### v<N+1>` entry under `## Changelog` in `frontend/lib/os/engine/engine.md`.
2. Ask the assistant to "check for an OS upgrade."
3. Expect: it describes the changelog entry, in the OS's confirmed language, and asks for confirmation — without having changed anything yet.
4. Decline. Confirm `AGENTS.md` is untouched, and the same offer reappears if asked again.
5. Ask again and confirm. Confirm `AGENTS.md`'s `os-engine-version` now matches the bumped value and its content reflects the change.

## Scenario D — Repair implicitly carries a version change (Story 1, Scenarios 4-5; Clarifications)

1. With `AGENTS.md`'s version behind current (as in Scenario C before confirming), damage `AGENTS.md` (e.g. truncate it) and ask the assistant to "repair the Company OS," not "upgrade."
2. Expect: before rebuilding, it shows the same change description Scenario C's upgrade check would show, and proceeds only after confirmation (FR-006a) — repair never silently changes version.
3. Separately, with `AGENTS.md`'s version already current, damage it and ask for a repair.
4. Expect: it rebuilds directly, no change description, no confirmation step (FR-006b).

## Scenario E — Pre-existing (v0) Company OS migrates without losing routing (Story 3)

1. Manually place `fixtures/legacy-agents-v0.md`'s content as the bucket's `AGENTS.md` (no `os-engine-version` front matter, an inline routing table in its body — the shape `en/init.md`'s old Phase 3 produced), with no `os/routing.md` present.
2. Ask the assistant to repair or upgrade it.
3. Expect: it recognizes this as version `0` (not an error), extracts every row of the inline routing table into a new `os/routing.md` before rebuilding `AGENTS.md`, and every one of those rows is present afterward (SC-002).
4. Confirm business data (`data/*`, `os/identity.md`, etc.) is untouched throughout (FR-014).

## Scenario F — Business setup self-triggers, once (Story 4, SC-005)

1. Take a Company OS whose `AGENTS.md` is fully built (`os-engine-version` set) but whose `data/` is empty (e.g. skip the interview in Scenario A, or delete `data/*` afterward).
2. Ask the assistant to do an unrelated task (e.g. "what's on today's plan").
3. Expect: it recognizes business data is missing (via `list_directory "data/"`, per FR-012a) and offers the interview before proceeding — not silently, not by requiring the owner to say "init."
4. Complete the interview. Ask for an unrelated task again.
5. Expect: no second interview is offered — business setup ran exactly once (SC-005).

## Scenario G — Routing edits never touch AGENTS.md (Story 4, Scenario 3; SC-004)

1. On a fully set-up Company OS, add a new domain skill and its corresponding row in `os/routing.md` (directly, or by asking the assistant to add a skill).
2. Confirm `AGENTS.md`'s content and `os-engine-version` are unchanged by this edit.
