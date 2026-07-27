import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createDirectory } from "@/lib/storage/directories";
import { createFile } from "@/lib/storage/files";
import { hasAnyObjectWithPrefix } from "@/lib/storage/paths";
import { SupportedLanguage } from "@/lib/i18n/languages";

export type OsStatus = "empty" | "already_initialized" | "partial";

/**
 * Fixed, product-provided `AGENTS.md` stub, one per supported language
 * (spec 015 research.md §4) — kept as a plain Markdown file in
 * ./templates/<language>/ (not an inline string constant) so it can be
 * edited directly. Read once at module load, with the path spelled out
 * literally (not built from a runtime variable) so Vercel's build-time file
 * tracing (`@vercel/nft`) can find and bundle all six files — the same
 * reasoning as spec 014's original single-language template (research.md §5).
 * `process.cwd()` is the Next.js project root (`frontend/`) both in
 * `next dev` and in a deployed serverless function.
 *
 * Spec 016: this used to be a pair (`AGENTS.md` + `os/skills/init.md`) — the
 * second file is gone. The engine+business-setup content it held now lives
 * once, in English, as MCP resources (`lib/os/engine/*.md`, never written to
 * the bucket) — this stub's only job is pointing whatever assistant connects
 * next at that MCP connection instead of a bucket file (research.md §7).
 */
const TEMPLATES_DIR = join(process.cwd(), "lib/os/templates");

function loadAgentsMdStub(language: SupportedLanguage): string {
  return readFileSync(join(TEMPLATES_DIR, language, "AGENTS.md"), "utf-8");
}

const AGENTS_MD_STUBS: Record<SupportedLanguage, string> = {
  en: loadAgentsMdStub("en"),
  it: loadAgentsMdStub("it"),
  ru: loadAgentsMdStub("ru"),
  fr: loadAgentsMdStub("fr"),
  de: loadAgentsMdStub("de"),
  es: loadAgentsMdStub("es"),
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
 * the `AGENTS.md` stub and the permanent `os/language` marker (spec 015,
 * FR-006, FR-007); no business-specific content is written here. `os/`'s
 * real content (`AGENTS.md`'s full router, `os/identity.md`, everything
 * else business-specific) is deliberately left for the connected AI
 * assistant, via the `init`/`engine` MCP resources, not asked for through
 * this app (FR-007 removed, 2026-07-25 revision; spec 016 contracts/
 * init-skeleton.md — `os/skills/init.md` is no longer written at all, since
 * that content is now MCP-only, per spec 016 FR-001).
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

  await createDirectory("os");
  await createDirectory("data");
  await createFile("AGENTS.md", AGENTS_MD_STUBS[language]);
  await createFile("os/language", language);

  return { created: true };
}
