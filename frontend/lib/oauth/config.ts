import { timingSafeEqual } from "node:crypto";
import { OAuthConfigError } from "./errors";

/**
 * The dedicated owner sign-in identity (data-model.md OwnerCredential,
 * spec.md FR-009) — separate from the S3/MinIO storage credentials in
 * lib/storage/config.ts. Stored and compared as plain text (research.md §4)
 * per the owner's explicit choice, prioritizing simple setup for a
 * single-owner self-hosted tool over defense-in-depth against the
 * credential's own storage location.
 */
export interface OwnerCredentialConfig {
  username: string;
  password: string;
}

/**
 * Reads OAUTH_OWNER_USERNAME / OAUTH_OWNER_PASSWORD from process.env. Never
 * throws, even if missing — safe to call at module-import time (mirrors
 * lib/storage/config.ts's readStorageConfig()). Use
 * validateOwnerCredentialConfig() to check the result before relying on it.
 */
export function readOwnerCredentialConfig(): OwnerCredentialConfig {
  return {
    username: process.env.OAUTH_OWNER_USERNAME?.trim() ?? "",
    password: process.env.OAUTH_OWNER_PASSWORD ?? "",
  };
}

/**
 * Validates a config produced by readOwnerCredentialConfig(), throwing
 * OAuthConfigError naming every missing field — called once at process
 * startup (frontend/instrumentation.ts).
 */
export function validateOwnerCredentialConfig(config: OwnerCredentialConfig): void {
  const missing: string[] = [];
  if (!config.username) missing.push("OAUTH_OWNER_USERNAME");
  if (!config.password) missing.push("OAUTH_OWNER_PASSWORD");
  if (missing.length > 0) {
    throw new OAuthConfigError(`Missing required OAuth owner configuration: ${missing.join(", ")}`);
  }
}

/** Reads and validates the owner credential config in one step (frontend/instrumentation.ts). */
export function verifyOwnerCredentialConfig(): void {
  validateOwnerCredentialConfig(readOwnerCredentialConfig());
}

/** Verifies `password` against the configured plain-text password, using a timing-safe comparison. */
export function verifyOwnerPassword(password: string, configuredPassword: string): boolean {
  const actual = Buffer.from(password);
  const expected = Buffer.from(configuredPassword);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
