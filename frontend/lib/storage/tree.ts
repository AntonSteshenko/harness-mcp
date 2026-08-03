import { listDirectory } from "./directories";
import { isUnderTrash } from "./trash";

/** One file or directory discovered while walking a subtree (spec 022, data-model.md). */
export interface TreeEntry {
  path: string;
  kind: "file" | "directory";
  size?: number;
  lastModified?: string;
}

export interface WalkResult {
  entries: TreeEntry[];
  truncated: boolean;
}

/**
 * Response cap for list_directory_tree/find_files_by_name/search_file_content
 * (research.md §3) — bounds response size/latency for the "hundreds, not
 * millions, of entries" trees this feature targets (spec.md Assumptions).
 * A planning/implementation detail, not a product decision.
 */
export const MAX_TREE_ENTRIES = 500;

/**
 * Walks the subtree under `path` breadth-first, composing the existing
 * `listDirectory` (directories.ts) the same way `listFilesRecursive` already
 * does — generalized here to collect both files and directories at every
 * depth (not just `.md` files), exclude anything under `Trash` (FR-011), and
 * stop at MAX_TREE_ENTRIES with `truncated: true` (FR-012) instead of
 * exploring an unbounded tree. Inherits `listDirectory`'s not_found/
 * type_mismatch errors on the root `path` for free.
 */
export async function walkTree(path: string): Promise<WalkResult> {
  const entries: TreeEntry[] = [];
  const pending: string[] = [path];
  let truncated = false;

  while (pending.length > 0 && !truncated) {
    const current = pending.shift() as string;
    const { files, directories } = await listDirectory(current);

    for (const file of files) {
      if (isUnderTrash(file.path)) continue;
      if (entries.length >= MAX_TREE_ENTRIES) {
        truncated = true;
        break;
      }
      entries.push({ path: file.path, kind: "file", size: file.size, lastModified: file.lastModified });
    }

    if (truncated) break;

    for (const dir of directories) {
      if (isUnderTrash(dir.path)) continue;
      if (entries.length >= MAX_TREE_ENTRIES) {
        truncated = true;
        break;
      }
      entries.push({ path: dir.path, kind: "directory" });
      pending.push(dir.path);
    }
  }

  return { entries, truncated };
}

/** Last non-empty path segment of `path` (its own file/directory name), ignoring a trailing slash. */
function baseName(path: string): string {
  const trimmed = path.endsWith("/") ? path.slice(0, -1) : path;
  const idx = trimmed.lastIndexOf("/");
  return idx === -1 ? trimmed : trimmed.slice(idx + 1);
}

/**
 * True if `entry`'s own name (not its full path) contains `query`,
 * case-insensitively (research.md §4) — so searching "skills" matches the
 * `os/skills/` directory itself but not every file underneath it.
 */
export function matchesName(entry: TreeEntry, query: string): boolean {
  return baseName(entry.path).toLowerCase().includes(query.toLowerCase());
}

/**
 * Builds a short excerpt of `content` around the first case-insensitive
 * match of `query`, so a caller can judge relevance without a separate
 * read_file call (data-model.md's ContentMatch.snippet). Returns an empty
 * string if `query` isn't found (callers only invoke this after confirming a
 * match).
 */
export function buildSnippet(content: string, query: string, radius = 60): string {
  const idx = content.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return "";

  const start = Math.max(0, idx - radius);
  const end = Math.min(content.length, idx + query.length + radius);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < content.length ? "..." : "";
  return `${prefix}${content.slice(start, end).trim()}${suffix}`;
}
