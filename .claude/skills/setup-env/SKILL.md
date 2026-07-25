---
name: "setup-env"
description: "Interactively creates/fills in a frontend/.env* file (e.g. .env.local, .env.development.local) by walking through each variable in frontend/.env.example and asking the user for a value."
user-invocable: true
disable-model-invocation: false
---

## Purpose

`frontend/.env.example` documents every variable the Next.js app reads (S3/storage connection, OAuth owner credential, MCP bootstrap path, OS_NAME branding, etc.). Next.js loads config from any file starting with `.env` (`.env`, `.env.local`, `.env.development`, `.env.development.local`, `.env.production.local`, etc.) — there is no single fixed filename, and several such files can coexist for different purposes (e.g. one per environment/deployment). `frontend/.gitignore` covers all of them with a blanket `.env*` pattern (except `.env.example` itself, which is intentionally tracked as the template) — none of them are ever committed.

This skill exists so any one of these files can be created or updated without the user having to hand-copy and decode `.env.example` themselves.

## Steps

1. **Determine the target filename** — never assume `.env.local`. List every `frontend/.env*` file that currently exists (excluding `.env.example`). Ask the user (AskUserQuestion) which file this run targets:
   - Each existing `.env*` file found, offered as an option ("update `<name>`")
   - "Create a new one" — if chosen, ask for the filename (must start with `.env`); tell the user which Next.js env file it corresponds to if the name implies a specific load order (`.env.local` loads everywhere; `.env.development`/`.env.production` are environment-specific; the `.local` variants are per-machine overrides not meant to be shared)
   - If exactly one `.env*` file already exists, you may skip this question and confirm your assumption in one line instead of formally asking (e.g. "I'll update the existing `.env.local`") — only ask when there's a real choice (multiple existing files, or none yet)

2. Read `frontend/.env.example` and parse it into an ordered list of variables. For each variable, capture:
   - Its `KEY`
   - The full comment block immediately above it (this is the human-readable description — use it verbatim when asking the user, don't paraphrase it away)
   - Its example value, and whether that value is a **usable default as-is** (e.g. `S3_REGION=us-east-1`, `S3_FORCE_PATH_STYLE=true`) or a **placeholder that must be replaced** for anything beyond the exact local-MinIO setup this repo ships with (e.g. `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY` when not using the bundled local MinIO, `OAUTH_OWNER_PASSWORD` which ships empty on purpose)

3. **Check the target file chosen in step 1:**
   - If it already exists, read it first. Ask the user (AskUserQuestion) whether to: (a) only fill in variables that are missing or empty, (b) review every variable and confirm/replace each one, or (c) cancel. Never silently overwrite existing values — a value already set (especially a secret) may be real, working configuration you must not clobber without being asked.
   - If it doesn't exist, confirm with the user that you're creating it from `frontend/.env.example` before writing anything.

4. **Walk through the variables that need input** (skip ones already confirmed-good in step 3). Group related variables into single questions where it keeps things efficient (e.g. the S3 credential pair), but never batch a secret together with its own confirmation in a way that could leak it into a summary. For each:
   - If the variable is a **secret** (name contains `PASSWORD`, `SECRET`, `KEY`, or `TOKEN`): ask the user to provide it as free text, tell them they can leave it blank to fill in by hand later, and once set, never echo the value back in your own messages or summaries — refer to it as "set" / "left blank", not by its contents.
   - If the variable is a **small closed set of options** (e.g. `S3_FORCE_PATH_STYLE` true/false, or picking between the bundled local MinIO vs. a custom S3-compatible provider for the whole `S3_*` block): use AskUserQuestion with the sensible default recommended and pre-labeled "(Recommended)".
   - If the variable already has a good local-dev default and nothing in the conversation suggests the user needs something else (e.g. `S3_REGION`, `MCP_BOOTSTRAP_PATH`): don't interrupt with a question — state the default you're using in one line and move on, only pausing if the user corrects you.
   - For `OS_NAME`: mention it's optional (defaults to `harness-mcp` if left unset) — ask once for a branding name, or accept the default silently if the user shows no preference.

5. **Write the file**, preserving every comment block and blank-line grouping from `frontend/.env.example`'s structure — the result should read like a filled-in copy of the example, not a stripped `KEY=value` dump. Use the Read tool first if the target file already exists (required before Edit/Write can touch it), then Edit/Write to produce the final content.

6. **Confirm gitignore coverage** before finishing: check that the chosen filename actually matches a pattern in `frontend/.gitignore` (currently a blanket `.env*`, which covers any name starting with `.env` — this is a safety check for future drift, not an expected fix). If the user picked a filename that somehow wouldn't be covered (e.g. gitignore rules changed since this skill was written), stop and flag it rather than silently proceeding.

7. **Summarize** what was created/updated (filename and which variables were touched, never values for secrets) and remind the user of the next step: `npm install` (if not already done) then `npm run dev`.

## Notes

- This skill only ever writes to a `frontend/.env*` file (never `.env.example` itself), all gitignored and local-only — it must never commit these files or print full secret values into chat.
- If a variable's comment references a spec (e.g. "spec 007-s3-storage-config"), you may skim that spec's `quickstart.md` if the user seems unsure what a value should be, but don't require reading it up front — the `.env.example` comments are already written to be self-sufficient for the common cases.
