import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { BUCKET, s3Client } from "./client";
import { alreadyExists, notFound, typeMismatch, wrapStorageError } from "./errors";
import { move } from "./move";
import {
  hasAnyObjectWithPrefix,
  headObjectExists,
  isNotFoundError,
  normalizeDirectoryPath,
  normalizeFilePath,
} from "./paths";
import { isUnderTrash, trashDestinationFor } from "./trash";
import { mimeTypeForPath } from "./fileTypes";

export interface FileMetadata {
  path: string;
  size: number;
  lastModified: string;
  /** S3's opaque ETag (quoted hex string), used to cheaply detect whether a
   * file changed since it was last loaded (spec 019 research.md §3) —
   * compare it as an opaque string, never parse or reformat it. */
  etag: string;
  /** MIME type recorded at upload time; falls back to extension-based
   * inference for objects written before this field existed (spec 028
   * research.md §3). */
  contentType: string;
}

export interface FileContent extends FileMetadata {
  content: Buffer;
}

/**
 * Creates a file at `path`, overwriting it if a file already exists there.
 * Rejects with `already_exists` if a directory occupies `path` (FR-002, FR-012).
 * `content` is raw bytes — never decoded/re-encoded as text, so binary
 * uploads survive byte-for-byte (spec 028 FR-003).
 */
export async function createFile(path: string, content: Buffer, contentType?: string): Promise<FileMetadata> {
  const key = normalizeFilePath(path);
  const resolvedContentType = contentType || mimeTypeForPath(path);

  try {
    if (await hasAnyObjectWithPrefix(normalizeDirectoryPath(key))) {
      throw alreadyExists(path);
    }

    const result = await s3Client.send(
      new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: content, ContentType: resolvedContentType }),
    );

    return {
      path,
      size: content.byteLength,
      lastModified: new Date().toISOString(),
      etag: result.ETag ?? "",
      contentType: resolvedContentType,
    };
  } catch (err) {
    throw wrapStorageError(err, `creating file "${path}"`);
  }
}

/** Reads the full content of the file at `path` (FR-003). Returns raw bytes;
 * callers that need text (e.g. the editor's text-viewing path) decode
 * explicitly after confirming the file is text-viewable (spec 028
 * research.md §2, §4). */
export async function readFile(path: string): Promise<FileContent> {
  const key = normalizeFilePath(path);

  try {
    const result = await s3Client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    const bytes = (await result.Body?.transformToByteArray()) ?? new Uint8Array();
    const content = Buffer.from(bytes);
    return {
      path,
      content,
      size: result.ContentLength ?? content.byteLength,
      lastModified: (result.LastModified ?? new Date()).toISOString(),
      etag: result.ETag ?? "",
      contentType: result.ContentType || mimeTypeForPath(path),
    };
  } catch (err) {
    if (isNotFoundError(err)) {
      if (await hasAnyObjectWithPrefix(normalizeDirectoryPath(key))) {
        throw typeMismatch(path, "file");
      }
      throw notFound(path);
    }
    throw wrapStorageError(err, `reading file "${path}"`);
  }
}

/**
 * Overwrites the content of an existing file at `path` (FR-004 — whole-file
 * overwrite only). Unlike `createFile`, requires the file to already exist:
 * `not_found` if missing; `type_mismatch` if `path` is a directory.
 */
export async function updateFile(path: string, content: Buffer, contentType?: string): Promise<FileMetadata> {
  const key = normalizeFilePath(path);
  const resolvedContentType = contentType || mimeTypeForPath(path);

  try {
    if (!(await headObjectExists(key))) {
      if (await hasAnyObjectWithPrefix(normalizeDirectoryPath(key))) {
        throw typeMismatch(path, "file");
      }
      throw notFound(path);
    }

    const result = await s3Client.send(
      new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: content, ContentType: resolvedContentType }),
    );
    return {
      path,
      size: content.byteLength,
      lastModified: new Date().toISOString(),
      etag: result.ETag ?? "",
      contentType: resolvedContentType,
    };
  } catch (err) {
    throw wrapStorageError(err, `updating file "${path}"`);
  }
}

/**
 * Cheaply checks whether the file at `path` has changed, without
 * transferring its content (`HeadObjectCommand`, mirroring `headObjectExists`
 * in `lib/storage/paths.ts`). `not_found`/`type_mismatch` on the same terms
 * as `readFile()` (spec 019 research.md §2, FR-002, FR-010).
 */
export async function getFileMetadata(path: string): Promise<FileMetadata> {
  const key = normalizeFilePath(path);

  try {
    const result = await s3Client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return {
      path,
      size: result.ContentLength ?? 0,
      lastModified: (result.LastModified ?? new Date()).toISOString(),
      etag: result.ETag ?? "",
      contentType: result.ContentType || mimeTypeForPath(path),
    };
  } catch (err) {
    if (isNotFoundError(err)) {
      if (await hasAnyObjectWithPrefix(normalizeDirectoryPath(key))) {
        throw typeMismatch(path, "file");
      }
      throw notFound(path);
    }
    throw wrapStorageError(err, `reading metadata for "${path}"`);
  }
}

/**
 * Deletes the file at `path` (FR-005). Per spec 011 FR-001/FR-003/FR-005:
 * a path outside `Trash` is moved into `Trash` instead of being destroyed
 * (soft-delete); a path already under `Trash` is destroyed for real
 * (permanent delete) — this is how a caller empties something out of Trash.
 */
export async function deleteFile(
  path: string,
): Promise<{ path: string; deleted: true; permanent: boolean; trashedTo?: string }> {
  const key = normalizeFilePath(path);

  try {
    if (!(await headObjectExists(key))) {
      if (await hasAnyObjectWithPrefix(normalizeDirectoryPath(key))) {
        throw typeMismatch(path, "file");
      }
      throw notFound(path);
    }

    if (isUnderTrash(path)) {
      await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
      return { path, deleted: true, permanent: true };
    }

    const trashedTo = trashDestinationFor(path);
    await move(path, trashedTo);
    return { path, deleted: true, permanent: false, trashedTo };
  } catch (err) {
    throw wrapStorageError(err, `deleting file "${path}"`);
  }
}
