import { DeleteObjectsCommand, ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3";
import { OAUTH_PREFIX } from "@/lib/oauth/store";
import { BUCKET, s3Client } from "./client";
import { alreadyExists, notFound, typeMismatch, wrapStorageError } from "./errors";
import { move } from "./move";
import { headObjectExists, normalizeDirectoryPath, normalizeFilePath } from "./paths";
import { isUnderTrash, trashDestinationFor } from "./trash";

export interface DirectoryEntry {
  files: Array<{ path: string; size: number; lastModified: string }>;
  directories: Array<{ path: string }>;
}

/**
 * Creates a directory at `path` (a zero-byte marker object, research.md §3).
 * Idempotent. Rejects with `already_exists` if a file exists at `path` (FR-007, FR-012).
 */
export async function createDirectory(path: string): Promise<{ path: string; created: true }> {
  const dirKey = normalizeDirectoryPath(path);
  const fileKey = normalizeFilePath(path);

  try {
    if (fileKey !== "" && (await headObjectExists(fileKey))) {
      throw alreadyExists(path);
    }

    await s3Client.send(new PutObjectCommand({ Bucket: BUCKET, Key: dirKey, Body: "" }));
    return { path, created: true };
  } catch (err) {
    throw wrapStorageError(err, `creating directory "${path}"`);
  }
}

/**
 * Lists the direct children of the directory at `path` (FR-006). Not_found
 * if nothing exists there; type_mismatch if `path` is a file.
 */
export async function listDirectory(path: string): Promise<{ path: string } & DirectoryEntry> {
  const dirKey = normalizeDirectoryPath(path);
  const fileKey = normalizeFilePath(path);

  try {
    if (fileKey !== "" && (await headObjectExists(fileKey))) {
      throw typeMismatch(path, "directory");
    }

    const result = await s3Client.send(
      new ListObjectsV2Command({ Bucket: BUCKET, Prefix: dirKey, Delimiter: "/" }),
    );

    if (dirKey !== "" && (result.KeyCount ?? 0) === 0) {
      throw notFound(path);
    }

    const files = (result.Contents ?? [])
      .filter((obj) => obj.Key && obj.Key !== dirKey && !obj.Key.startsWith(OAUTH_PREFIX)) // exclude the directory's own marker object and reserved OAuth state
      .map((obj) => ({
        path: obj.Key as string,
        size: obj.Size ?? 0,
        lastModified: (obj.LastModified ?? new Date()).toISOString(),
      }));

    const directories = (result.CommonPrefixes ?? [])
      .filter((p) => p.Prefix && p.Prefix !== OAUTH_PREFIX)
      .map((p) => ({ path: p.Prefix as string }));

    return { path, files, directories };
  } catch (err) {
    throw wrapStorageError(err, `listing directory "${path}"`);
  }
}

/**
 * Deletes the directory at `path` and everything inside it, recursively
 * (FR-008). Not_found if missing; type_mismatch if `path` is a file. Per
 * spec 011 FR-002/FR-003/FR-006: a path outside `Trash` is moved into
 * `Trash` instead of being destroyed (soft-delete); a path already under
 * `Trash` (including `Trash` itself) is destroyed for real (permanent
 * delete) — calling this on `Trash` itself empties it entirely.
 */
export async function deleteDirectory(
  path: string,
): Promise<{ path: string; deleted: true; permanent: boolean; filesRemoved: number; trashedTo?: string }> {
  const dirKey = normalizeDirectoryPath(path);
  const fileKey = normalizeFilePath(path);

  try {
    if (fileKey !== "" && (await headObjectExists(fileKey))) {
      throw typeMismatch(path, "directory");
    }

    const allKeys: string[] = [];
    let continuationToken: string | undefined;
    do {
      const page = await s3Client.send(
        new ListObjectsV2Command({
          Bucket: BUCKET,
          Prefix: dirKey,
          ContinuationToken: continuationToken,
        }),
      );
      for (const obj of page.Contents ?? []) {
        if (obj.Key) allKeys.push(obj.Key);
      }
      continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (continuationToken);

    if (allKeys.length === 0) {
      throw notFound(path);
    }

    const filesRemoved = allKeys.filter((k) => !k.endsWith("/")).length;

    if (isUnderTrash(path)) {
      for (let i = 0; i < allKeys.length; i += 1000) {
        const batch = allKeys.slice(i, i + 1000);
        await s3Client.send(
          new DeleteObjectsCommand({
            Bucket: BUCKET,
            Delete: { Objects: batch.map((Key) => ({ Key })) },
          }),
        );
      }
      return { path, deleted: true, permanent: true, filesRemoved };
    }

    const trashedTo = trashDestinationFor(path);
    await move(path, trashedTo);
    return { path, deleted: true, permanent: false, filesRemoved, trashedTo };
  } catch (err) {
    throw wrapStorageError(err, `deleting directory "${path}"`);
  }
}

/**
 * Walks the subtree under `path` breadth-first (composing `listDirectory`)
 * and returns every file whose path ends in `.md` (case-insensitive) at any
 * depth. Used by folder download (contracts/api-routes.md, research.md §2).
 * Not_found if `path` doesn't exist; type_mismatch if `path` is a file.
 */
export async function listFilesRecursive(
  path: string,
): Promise<Array<{ path: string; size: number; lastModified: string }>> {
  const results: Array<{ path: string; size: number; lastModified: string }> = [];
  const pending: string[] = [path];

  while (pending.length > 0) {
    const current = pending.shift() as string;
    const { files, directories } = await listDirectory(current);

    for (const file of files) {
      if (file.path.toLowerCase().endsWith(".md")) {
        results.push(file);
      }
    }
    for (const dir of directories) {
      pending.push(dir.path);
    }
  }

  return results;
}
