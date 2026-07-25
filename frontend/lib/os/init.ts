import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createDirectory } from "@/lib/storage/directories";
import { createFile } from "@/lib/storage/files";
import { hasAnyObjectWithPrefix } from "@/lib/storage/paths";

export type OsStatus = "empty" | "already_initialized" | "partial";

/**
 * Fixed, product-provided templates (FR-008, FR-009) — kept as plain
 * Markdown files in ./templates/ (not inline string constants) so they can
 * be edited directly. Read once at module load; `process.cwd()` is the
 * Next.js project root (`frontend/`) both in `next dev` and in a deployed
 * serverless function.
 */
const TEMPLATES_DIR = join(process.cwd(), "lib/os/templates");

export const AGENTS_MD_TEMPLATE = readFileSync(join(TEMPLATES_DIR, "AGENTS.md"), "utf-8");
export const INIT_SKILL_MD_TEMPLATE = readFileSync(join(TEMPLATES_DIR, "init.md"), "utf-8");

/**
 * Determines /init's post-connectivity state (research.md §3) — only
 * meaningful once the caller has already confirmed storage is connected.
 */
export async function checkOsStatus(): Promise<OsStatus> {
  const [hasOs, hasData] = await Promise.all([
    hasAnyObjectWithPrefix("os/"),
    hasAnyObjectWithPrefix("data/"),
  ]);

  if (hasOs && hasData) return "already_initialized";
  if (!hasOs && !hasData) return "empty";
  return "partial";
}

/**
 * Creates the initial Company OS skeleton (FR-006, FR-008, FR-009) — just
 * the router (`AGENTS.md`) and the init skill (`os/skills/init.md`); no
 * business-specific content is written here. `os/identity.md` and
 * everything else business-specific is deliberately left for the connected
 * AI assistant's own interview (the init skill's own "Fase 1 — Intervista"),
 * not asked for through this app (FR-007 removed, 2026-07-25 revision).
 * Re-checks checkOsStatus() first and is a no-op if either /os or /data
 * already exists, closing most of the check-then-act race a double-submit
 * could otherwise open (research.md §4, FR-011, SC-004).
 */
export async function initializeCompanyOs(): Promise<{ created: boolean }> {
  const status = await checkOsStatus();
  if (status !== "empty") {
    return { created: false };
  }

  await createDirectory("os");
  await createDirectory("data");
  await createFile("AGENTS.md", AGENTS_MD_TEMPLATE);
  await createFile("os/skills/init.md", INIT_SKILL_MD_TEMPLATE);

  return { created: true };
}
