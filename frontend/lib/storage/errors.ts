export type StorageErrorCode =
  | "not_found"
  | "type_mismatch"
  | "already_exists"
  | "storage_unreachable";

export class StorageError extends Error {
  code: StorageErrorCode;

  constructor(code: StorageErrorCode, message: string) {
    super(message);
    this.name = "StorageError";
    this.code = code;
  }
}

export function notFound(path: string): StorageError {
  return new StorageError("not_found", `No file or directory exists at "${path}"`);
}

export function typeMismatch(path: string, expected: "file" | "directory"): StorageError {
  return new StorageError(
    "type_mismatch",
    `"${path}" exists but is not a ${expected}`,
  );
}

export function alreadyExists(path: string): StorageError {
  return new StorageError(
    "already_exists",
    `An entry of a different type already exists at "${path}"`,
  );
}

/**
 * Wraps a raw error from the S3 client into a StorageError, mapping
 * connectivity failures to `storage_unreachable` (Edge Cases) and passing
 * through errors that are already StorageErrors unchanged.
 */
export function wrapStorageError(err: unknown, context: string): StorageError {
  if (err instanceof StorageError) {
    return err;
  }

  const code = (err as { code?: string; Code?: string })?.code ?? (err as { Code?: string })?.Code;
  const name = (err as { name?: string })?.name;

  const connectivityIndicators = new Set([
    "ECONNREFUSED",
    "ENOTFOUND",
    "ETIMEDOUT",
    "EHOSTUNREACH",
    "TimeoutError",
    "NetworkingError",
  ]);

  if (
    (code && connectivityIndicators.has(code)) ||
    (name && connectivityIndicators.has(name))
  ) {
    return new StorageError(
      "storage_unreachable",
      `Could not reach the local S3 storage while ${context}`,
    );
  }

  return new StorageError(
    "storage_unreachable",
    `Unexpected storage error while ${context}: ${(err as Error)?.message ?? String(err)}`,
  );
}
