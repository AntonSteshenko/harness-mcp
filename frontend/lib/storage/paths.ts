import { HeadObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { BUCKET, s3Client } from "./client";

export type PathKind = "file" | "directory" | "none";

export function normalizeFilePath(path: string): string {
  return path.trim().replace(/\/+/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
}

export function normalizeDirectoryPath(path: string): string {
  const trimmed = path.trim().replace(/\/+/g, "/").replace(/^\/+/, "");
  if (trimmed === "") return "";
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

export function isNotFoundError(err: unknown): boolean {
  const name = (err as { name?: string })?.name;
  const status = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
  return name === "NotFound" || name === "NoSuchKey" || status === 404;
}

export async function headObjectExists(key: string): Promise<boolean> {
  try {
    await s3Client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch (err) {
    if (isNotFoundError(err)) return false;
    throw err;
  }
}

export async function hasAnyObjectWithPrefix(prefix: string): Promise<boolean> {
  const result = await s3Client.send(
    new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, MaxKeys: 1 }),
  );
  return (result.KeyCount ?? 0) > 0;
}

/**
 * Determines whether `path` currently denotes a File, a Directory, or
 * nothing at all — used to implement the not_found / type_mismatch /
 * already_exists error contract (contracts/mcp-tools.md).
 */
export async function statPath(path: string): Promise<PathKind> {
  const filePath = normalizeFilePath(path);
  if (filePath !== "" && (await headObjectExists(filePath))) {
    return "file";
  }

  const dirPath = normalizeDirectoryPath(path);
  if (dirPath === "") return "directory"; // bucket root always exists as a directory
  return (await hasAnyObjectWithPrefix(dirPath)) ? "directory" : "none";
}
