import { createDirectory } from "@/lib/storage/directories";
import { createFile } from "@/lib/storage/files";
import { hasAnyObjectWithPrefix } from "@/lib/storage/paths";

export type OsStatus = "empty" | "already_initialized" | "partial";

export const AGENTS_MD_TEMPLATE = `# Agents

This bucket hosts a Company OS. For any question about how to operate this
system, read the skill at \`os/skills/init.md\` first.
`;

export const INIT_SKILL_MD_TEMPLATE = `# Init skill

You're connecting to a freshly created Company OS. Before doing anything else:

1. Read \`os/identity.md\` — it holds this business's name and a short description
   of what it does. Use it to understand who you're working for.
2. \`data/\` is reserved for this business's own content — read and write there
   as the business's activity requires.
3. \`os/\` holds the system's own self-description and operating guidance (this
   skill included) — treat it as configuration, not day-to-day content.
`;

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
 * Creates the initial Company OS structure (FR-006 through FR-009).
 * Re-checks checkOsStatus() first and is a no-op if either /os or /data
 * already exists, closing most of the check-then-act race a double-submit
 * could otherwise open (research.md §4, FR-011, SC-004).
 */
export async function initializeCompanyOs(
  businessName: string,
  businessDescription: string,
): Promise<{ created: boolean }> {
  const status = await checkOsStatus();
  if (status !== "empty") {
    return { created: false };
  }

  await createDirectory("os");
  await createDirectory("data");
  await createFile("os/identity.md", `# ${businessName}\n\n${businessDescription}\n`);
  await createFile("AGENTS.md", AGENTS_MD_TEMPLATE);
  await createFile("os/skills/init.md", INIT_SKILL_MD_TEMPLATE);

  return { created: true };
}
