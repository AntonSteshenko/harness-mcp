/**
 * Thrown by lib/oauth/config.ts's startup validation (FR-009), mirroring
 * lib/storage/errors.ts's StorageConfigError — fails fast via
 * instrumentation.ts rather than surfacing on the first sign-in attempt.
 */
export class OAuthConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OAuthConfigError";
  }
}

/**
 * Standard OAuth 2.0 error codes (RFC 6749 §5.2, §4.1.2.1) returned by the
 * Authorization Server endpoints (contracts/oauth-endpoints.md) — read by
 * third-party OAuth client libraries, so the shape/codes must not be
 * project-specific.
 */
export type OAuthErrorCode =
  | "invalid_request"
  | "invalid_client"
  | "invalid_grant"
  | "unauthorized_client"
  | "invalid_scope"
  | "unsupported_grant_type"
  | "access_denied"
  | "server_error";

export class OAuthError extends Error {
  code: OAuthErrorCode;

  constructor(code: OAuthErrorCode, message: string) {
    super(message);
    this.name = "OAuthError";
    this.code = code;
  }
}
