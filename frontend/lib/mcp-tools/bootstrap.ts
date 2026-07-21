import { readFile } from "@/lib/storage/files";

/**
 * Optional guidance extracted from the bootstrap file's HTML-comment markers
 * (contracts/tool-description-framing.md, spec 010-dynamic-tool-descriptions).
 */
export interface BootstrapMarkers {
  context?: string;
  triggers?: string[];
}

const CACHE_TTL_MS = 45_000;

let cache: { value: BootstrapMarkers | null; readAt: number } | null = null;

function parseMarkers(content: string): BootstrapMarkers | null {
  const contextMatch = content.match(/<!--\s*mcp-context:\s*([^>]*?)\s*-->/);
  const triggersMatch = content.match(/<!--\s*mcp-triggers:\s*([^>]*?)\s*-->/);

  const context = contextMatch?.[1]?.trim() || undefined;
  const triggers = triggersMatch?.[1]
    ?.split(",")
    .map((trigger) => trigger.trim())
    .filter((trigger) => trigger.length > 0);

  if (!context && (!triggers || triggers.length === 0)) {
    return null;
  }

  return { context, triggers: triggers && triggers.length > 0 ? triggers : undefined };
}

/**
 * Reads and parses the bootstrap file at MCP_BOOTSTRAP_PATH, caching the
 * result for CACHE_TTL_MS. Never throws: any missing config, unreadable
 * file, or absence of both markers resolves to `null` (FR-009), which the
 * description builders below treat as "no framing to add".
 */
export async function getBootstrapFraming(): Promise<BootstrapMarkers | null> {
  const now = Date.now();
  if (cache && now - cache.readAt < CACHE_TTL_MS) {
    return cache.value;
  }

  const value = await readBootstrapMarkers();
  cache = { value, readAt: now };
  return value;
}

async function readBootstrapMarkers(): Promise<BootstrapMarkers | null> {
  const path = process.env.MCP_BOOTSTRAP_PATH?.trim();
  if (!path) {
    return null;
  }

  try {
    const { content } = await readFile(path);
    return parseMarkers(content);
  } catch {
    return null;
  }
}

function entrySentence(framing: BootstrapMarkers | null): string | null {
  const bootstrapPath = process.env.MCP_BOOTSTRAP_PATH?.trim();
  if (!framing || !bootstrapPath) {
    return null;
  }

  const context = framing.context ?? "this storage";
  const usageClause = framing.triggers?.length
    ? ` Use it when the user wants: ${framing.triggers.join(", ")}.`
    : "";

  return (
    `Access to ${context}: a Markdown store.${usageClause} ` +
    `IMPORTANT: before acting, first read "${bootstrapPath}" and follow it.`
  );
}

function writeSentence(framing: BootstrapMarkers | null): string | null {
  const bootstrapPath = process.env.MCP_BOOTSTRAP_PATH?.trim();
  if (!framing || !bootstrapPath) {
    return null;
  }

  const context = framing.context ?? "this storage";
  return `Part of ${context}. Before writing, follow ${bootstrapPath}.`;
}

/** Prepends generated entry-tool framing to `base`, or returns `base` unchanged if none applies. */
export function buildEntryDescription(base: string, framing: BootstrapMarkers | null): string {
  const sentence = entrySentence(framing);
  return sentence ? `${sentence} ${base}` : base;
}

/** Prepends generated write-tool framing to `base`, or returns `base` unchanged if none applies. */
export function buildWriteDescription(base: string, framing: BootstrapMarkers | null): string {
  const sentence = writeSentence(framing);
  return sentence ? `${sentence} ${base}` : base;
}
