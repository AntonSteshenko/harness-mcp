import { CopyObjectCommand, DeleteObjectsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { BUCKET, s3Client } from "./client";
import { alreadyExists, notFound, wrapStorageError } from "./errors";
import { normalizeDirectoryPath, normalizeFilePath, statPath } from "./paths";

function copySourceFor(key: string): string {
  return `${BUCKET}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

async function listAllKeys(prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let continuationToken: string | undefined;
  do {
    const page = await s3Client.send(
      new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, ContinuationToken: continuationToken }),
    );
    for (const obj of page.Contents ?? []) {
      if (obj.Key) keys.push(obj.Key);
    }
    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);
  return keys;
}

async function deleteKeys(keys: string[]): Promise<void> {
  for (let i = 0; i < keys.length; i += 1000) {
    const batch = keys.slice(i, i + 1000);
    await s3Client.send(
      new DeleteObjectsCommand({ Bucket: BUCKET, Delete: { Objects: batch.map((Key) => ({ Key })) } }),
    );
  }
}

/**
 * Moves/renames a file or directory (research.md §5): detects whether
 * `sourcePath` is a File or Directory and performs the matching operation.
 * Copies happen before any delete so a failed copy never destroys data
 * (FR-009, FR-010).
 */
export async function move(
  sourcePath: string,
  destinationPath: string,
): Promise<{ sourcePath: string; destinationPath: string; moved: true }> {
  try {
    const kind = await statPath(sourcePath);
    if (kind === "none") throw notFound(sourcePath);

    const destinationKind = await statPath(destinationPath);
    if (destinationKind !== "none") throw alreadyExists(destinationPath);

    if (kind === "file") {
      const sourceKey = normalizeFilePath(sourcePath);
      const destKey = normalizeFilePath(destinationPath);

      await s3Client.send(
        new CopyObjectCommand({ Bucket: BUCKET, CopySource: copySourceFor(sourceKey), Key: destKey }),
      );
      await deleteKeys([sourceKey]);
    } else {
      const sourcePrefix = normalizeDirectoryPath(sourcePath);
      const destPrefix = normalizeDirectoryPath(destinationPath);
      const keys = await listAllKeys(sourcePrefix);

      await Promise.all(
        keys.map((key) => {
          const newKey = destPrefix + key.slice(sourcePrefix.length);
          return s3Client.send(
            new CopyObjectCommand({ Bucket: BUCKET, CopySource: copySourceFor(key), Key: newKey }),
          );
        }),
      );

      await deleteKeys(keys);
    }

    return { sourcePath, destinationPath, moved: true };
  } catch (err) {
    throw wrapStorageError(err, `moving "${sourcePath}" to "${destinationPath}"`);
  }
}
