import { StorageConfigError } from "./errors";

/**
 * The complete set of values needed to connect to one S3-compatible storage
 * backend (spec 007-s3-storage-config, data-model.md). Exactly one instance
 * is active per process, read once at startup.
 */
export interface StorageConnectionConfig {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  forcePathStyle: boolean;
}

/**
 * Reads the S3-compatible storage connection settings from process.env
 * (contracts/storage-env-contract.md), applying defaults for optional
 * fields. Never throws, even if required values are missing or malformed —
 * safe to call at module-import time (Next.js imports every route module
 * while collecting page data during `next build`, before any real
 * environment is guaranteed to be present). Use validateStorageConfig() to
 * check the result before relying on it.
 */
export function readStorageConfig(): StorageConnectionConfig {
  return {
    endpoint: process.env.S3_ENDPOINT?.trim() ?? "",
    region: process.env.S3_REGION?.trim() || "us-east-1",
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    bucket: process.env.S3_BUCKET?.trim() ?? "",
    forcePathStyle: (process.env.S3_FORCE_PATH_STYLE?.trim().toLowerCase() ?? "true") !== "false",
  };
}

/**
 * Validates a config produced by readStorageConfig(), throwing
 * StorageConfigError naming every missing field, or describing the first
 * invalid one, rather than accepting a partial/malformed config
 * (FR-004, data-model.md Validation rules). Called explicitly at process
 * startup (frontend/instrumentation.ts via verifyStorageConnection()) —
 * never at module-import time.
 */
export function validateStorageConfig(config: StorageConnectionConfig): void {
  const missing: string[] = [];
  if (!config.endpoint) missing.push("S3_ENDPOINT");
  if (!config.accessKeyId) missing.push("S3_ACCESS_KEY_ID");
  if (!config.secretAccessKey) missing.push("S3_SECRET_ACCESS_KEY");
  if (!config.bucket) missing.push("S3_BUCKET");
  if (missing.length > 0) {
    throw new StorageConfigError(
      "missing_config",
      `Missing required storage configuration: ${missing.join(", ")}`,
    );
  }

  let url: URL;
  try {
    url = new URL(config.endpoint);
  } catch {
    throw new StorageConfigError(
      "invalid_config",
      `S3_ENDPOINT is not a valid URL (got "${config.endpoint}")`,
    );
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new StorageConfigError(
      "invalid_config",
      `S3_ENDPOINT must use http:// or https:// (got "${config.endpoint}")`,
    );
  }

  const rawForcePathStyle = process.env.S3_FORCE_PATH_STYLE?.trim().toLowerCase();
  if (rawForcePathStyle !== undefined && rawForcePathStyle !== "" && rawForcePathStyle !== "true" && rawForcePathStyle !== "false") {
    throw new StorageConfigError(
      "invalid_config",
      `S3_FORCE_PATH_STYLE must be "true" or "false" (got "${process.env.S3_FORCE_PATH_STYLE}")`,
    );
  }
}
