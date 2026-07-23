import { randomBytes } from "node:crypto";
import { normalizeDirectoryPath, normalizeFilePath } from "./paths";

const TRASH_PREFIX = "Trash/";

/**
 * True if `path` is already located under the reserved `Trash` folder
 * (spec 011, research.md §3) — a case-sensitive, full-segment prefix check,
 * so `TrashCan/notes.md` is `false`.
 */
export function isUnderTrash(path: string): boolean {
  const normalized = normalizeDirectoryPath(path);
  return normalized === TRASH_PREFIX || normalized.startsWith(TRASH_PREFIX);
}

/**
 * Computes the destination path for soft-deleting `path` into `Trash`
 * (spec 011 FR-003, research.md §2): a per-call `opId` (timestamp + random
 * suffix, guaranteeing two delete operations never collide even on the same
 * original path, FR-007) followed by the item's original relative path.
 */
export function trashDestinationFor(path: string): string {
  const timestamp = new Date().toISOString().replace(/[-:.]/g, "");
  const random = randomBytes(3).toString("hex");
  const opId = `${timestamp}-${random}`;
  return `${TRASH_PREFIX}${opId}/${normalizeFilePath(path)}`;
}
