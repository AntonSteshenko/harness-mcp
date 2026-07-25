import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createDirectory } from "@/lib/storage/directories";
import { createFile } from "@/lib/storage/files";
import { hasAnyObjectWithPrefix } from "@/lib/storage/paths";
import { SupportedLanguage } from "@/lib/i18n/languages";

export type OsStatus = "empty" | "already_initialized" | "partial";

/**
 * Fixed, product-provided templates (FR-008, FR-009), one pair per supported
 * language (spec 015, research.md §4) — kept as plain Markdown files in
 * ./templates/<language>/ (not inline string constants) so they can be
 * edited directly. Read once at module load, with every path spelled out
 * literally (not built from a runtime variable) so Vercel's build-time file
 * tracing (`@vercel/nft`) can find and bundle all twelve files — the same
 * reasoning as spec 014's original single-language template (research.md §5).
 * `process.cwd()` is the Next.js project root (`frontend/`) both in
 * `next dev` and in a deployed serverless function.
 */
const TEMPLATES_DIR = join(process.cwd(), "lib/os/templates");

interface SkeletonTemplate {
  agentsMd: string;
  initSkillMd: string;
}

function loadTemplate(language: SupportedLanguage): SkeletonTemplate {
  return {
    agentsMd: readFileSync(join(TEMPLATES_DIR, language, "AGENTS.md"), "utf-8"),
    initSkillMd: readFileSync(join(TEMPLATES_DIR, language, "init.md"), "utf-8"),
  };
}

const SKELETON_TEMPLATES: Record<SupportedLanguage, SkeletonTemplate> = {
  en: loadTemplate("en"),
  it: loadTemplate("it"),
  ru: loadTemplate("ru"),
  fr: loadTemplate("fr"),
  de: loadTemplate("de"),
  es: loadTemplate("es"),
};

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
 * the router (`AGENTS.md`), the init skill (`os/skills/init.md`), and the
 * permanent `os/language` marker (spec 015, FR-006, FR-007); no
 * business-specific content is written here. `os/identity.md` and
 * everything else business-specific is deliberately left for the connected
 * AI assistant's own interview (the init skill's own "Fase 1 — Intervista"),
 * not asked for through this app (FR-007 removed, 2026-07-25 revision).
 * Re-checks checkOsStatus() first and is a no-op if either /os or /data
 * already exists, closing most of the check-then-act race a double-submit
 * could otherwise open (research.md §4, FR-011, SC-004) — now also covering
 * a second, conflicting `language` (spec 015 edge case).
 */
export async function initializeCompanyOs(language: SupportedLanguage): Promise<{ created: boolean }> {
  const status = await checkOsStatus();
  if (status !== "empty") {
    return { created: false };
  }

  const template = SKELETON_TEMPLATES[language];

  await createDirectory("os");
  await createDirectory("data");
  await createFile("AGENTS.md", template.agentsMd);
  await createFile("os/skills/init.md", template.initSkillMd);
  await createFile("os/language", language);

  return { created: true };
}
