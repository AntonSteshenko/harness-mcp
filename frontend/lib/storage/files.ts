import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { BUCKET, s3Client } from "./client";
import { alreadyExists, notFound, typeMismatch, wrapStorageError } from "./errors";
import {
  hasAnyObjectWithPrefix,
  headObjectExists,
  isNotFoundError,
  normalizeDirectoryPath,
  normalizeFilePath,
} from "./paths";

export interface FileMetadata {
  path: string;
  size: number;
  lastModified: string;
}

export interface FileContent extends FileMetadata {
  content: string;
}

/**
 * Creates a file at `path`, overwriting it if a file already exists there.
 * Rejects with `already_exists` if a directory occupies `path` (FR-002, FR-012).
 */
export async function createFile(path: string, content: string): Promise<FileMetadata> {
  const key = normalizeFilePath(path);

  try {
    if (await hasAnyObjectWithPrefix(normalizeDirectoryPath(key))) {
      throw alreadyExists(path);
    }

    await s3Client.send(
      new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: content }),
    );

    return { path, size: Buffer.byteLength(content), lastModified: new Date().toISOString() };
  } catch (err) {
    throw wrapStorageError(err, `creating file "${path}"`);
  }
}

/** Reads the full content of the file at `path` (FR-003). */
export async function readFile(path: string): Promise<FileContent> {
  const key = normalizeFilePath(path);

  try {
    const result = await s3Client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    const content = (await result.Body?.transformToString()) ?? "";
    return {
      path,
      content,
      size: result.ContentLength ?? Buffer.byteLength(content),
      lastModified: (result.LastModified ?? new Date()).toISOString(),
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
export async function updateFile(path: string, content: string): Promise<FileMetadata> {
  const key = normalizeFilePath(path);

  try {
    if (!(await headObjectExists(key))) {
      if (await hasAnyObjectWithPrefix(normalizeDirectoryPath(key))) {
        throw typeMismatch(path, "file");
      }
      throw notFound(path);
    }

    await s3Client.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: content }));
    return { path, size: Buffer.byteLength(content), lastModified: new Date().toISOString() };
  } catch (err) {
    throw wrapStorageError(err, `updating file "${path}"`);
  }
}

/** Deletes the file at `path` (FR-005). */
export async function deleteFile(path: string): Promise<{ path: string; deleted: true }> {
  const key = normalizeFilePath(path);

  try {
    if (!(await headObjectExists(key))) {
      if (await hasAnyObjectWithPrefix(normalizeDirectoryPath(key))) {
        throw typeMismatch(path, "file");
      }
      throw notFound(path);
    }

    await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    return { path, deleted: true };
  } catch (err) {
    throw wrapStorageError(err, `deleting file "${path}"`);
  }
}
