import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { BUCKET, s3Client } from "@/lib/storage/client";
import { isNotFoundError } from "@/lib/storage/paths";

/**
 * Reserved key prefix under the app's configured bucket used to persist
 * tool enable/disable state (spec 025, research.md §3). Mirrors
 * lib/oauth/store.ts's `.oauth/` and lib/messaging/store.ts's `.messaging/`
 * convention. Server-internal; excluded from the web file explorer and MCP
 * directory listings (see lib/storage/directories.ts).
 */
export const TOOLS_PREFIX = ".mcp-tools/";

function keyFor(relativeKey: string): string {
  return `${TOOLS_PREFIX}${relativeKey}.json`;
}

/** Reads and parses a JSON record, or `undefined` if it doesn't exist. */
async function getRecord<T>(relativeKey: string): Promise<T | undefined> {
  try {
    const result = await s3Client.send(
      new GetObjectCommand({ Bucket: BUCKET, Key: keyFor(relativeKey) }),
    );
    const body = (await result.Body?.transformToString()) ?? "";
    return body ? (JSON.parse(body) as T) : undefined;
  } catch (err) {
    if (isNotFoundError(err)) return undefined;
    throw err;
  }
}

/** Writes a JSON record, overwriting any existing value at `relativeKey`. */
async function putRecord<T>(relativeKey: string, value: T): Promise<void> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: keyFor(relativeKey),
      Body: JSON.stringify(value),
      ContentType: "application/json",
    }),
  );
}

/** The Tool Status Record (data-model.md) — a single record for all tools. */
interface ToolStatusRecord {
  disabledTools: string[];
}

const STATUS_KEY = "status";

/**
 * Every currently-disabled tool name, read fresh on every call — no
 * caching, since a fresh read is exactly what makes a confirmed change
 * effective on the very next /mcp request (research.md §1). Missing record
 * (first use, spec.md FR-011) means every tool is active.
 */
export async function getDisabledTools(): Promise<ReadonlySet<string>> {
  const record = await getRecord<ToolStatusRecord>(STATUS_KEY);
  return new Set(record?.disabledTools ?? []);
}

/**
 * Sets one tool's disabled state, read-modify-write over the single shared
 * record (research.md §2 — accepted non-atomicity, same tradeoff already
 * made by lib/messaging/rateLimit.ts's counter).
 */
export async function setToolDisabled(name: string, disabled: boolean): Promise<void> {
  const record = await getRecord<ToolStatusRecord>(STATUS_KEY);
  const disabledTools = new Set(record?.disabledTools ?? []);

  if (disabled) {
    disabledTools.add(name);
  } else {
    disabledTools.delete(name);
  }

  await putRecord<ToolStatusRecord>(STATUS_KEY, { disabledTools: [...disabledTools] });
}
