import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { readStorageConfig, validateStorageConfig } from "./config";
import { StorageConfigError } from "./errors";

const config = readStorageConfig();

export const s3Client = new S3Client({
  endpoint: config.endpoint,
  region: config.region,
  forcePathStyle: config.forcePathStyle,
  credentials: {
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
  },
});

export const BUCKET = config.bucket;

const CONNECTIVITY_ERROR_NAMES = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "ETIMEDOUT",
  "EHOSTUNREACH",
  "TimeoutError",
  "NetworkingError",
]);

const CREDENTIAL_ERROR_NAMES = new Set([
  "InvalidAccessKeyId",
  "SignatureDoesNotMatch",
  "AccessDenied",
  "Forbidden",
]);

/**
 * Verifies the configured storage backend is complete, reachable, that the
 * credentials are accepted, and that the configured bucket exists. Called
 * once at process startup (frontend/instrumentation.ts) so misconfiguration
 * fails fast (FR-004, FR-005) instead of surfacing on the first request.
 * Unlike the previous ensureBucket(), this never creates the bucket if it's
 * missing (research.md §3) — a missing bucket is reported as a
 * configuration error, since silently provisioning resources on an
 * arbitrary third-party provider is unsafe.
 */
export async function verifyStorageConnection(): Promise<void> {
  validateStorageConfig(config);

  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET }));
  } catch (err) {
    const code = (err as { code?: string; Code?: string; name?: string })?.code
      ?? (err as { Code?: string })?.Code
      ?? (err as { name?: string })?.name;
    const status = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;

    if (code && CONNECTIVITY_ERROR_NAMES.has(code)) {
      throw new StorageConfigError(
        "endpoint_unreachable",
        `Could not reach the storage endpoint configured in S3_ENDPOINT ("${config.endpoint}")`,
      );
    }

    if (status === 404 || code === "NotFound" || code === "NoSuchBucket") {
      throw new StorageConfigError(
        "bucket_not_found",
        `The bucket configured in S3_BUCKET ("${config.bucket}") does not exist on the configured storage endpoint`,
      );
    }

    if (status === 403 || (code && CREDENTIAL_ERROR_NAMES.has(code))) {
      throw new StorageConfigError(
        "credentials_rejected",
        "The configured S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY were rejected by the storage endpoint",
      );
    }

    throw new StorageConfigError(
      "endpoint_unreachable",
      `Unexpected error verifying the storage connection: ${(err as Error)?.message ?? String(err)}`,
    );
  }
}
