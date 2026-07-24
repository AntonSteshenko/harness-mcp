export interface RegisteredClient {
  clientId: string;
  clientName: string;
  redirectUris: string[];
  clientSecretHash: string | null;
  registeredAt: string;
}

export type GrantStatus = "active" | "revoked";

export interface AuthorizationGrant {
  grantId: string;
  clientId: string;
  status: GrantStatus;
  scope: "full_access";
  authorizedAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface AuthorizationCode {
  code: string;
  clientId: string;
  grantId: string;
  codeChallenge: string;
  redirectUri: string;
  expiresAt: string;
  consumedAt: string | null;
}

export type TokenKind = "access" | "refresh";

export interface Token {
  tokenId: string;
  pairId: string;
  kind: TokenKind;
  grantId: string;
  clientId: string;
  issuedAt: string;
  expiresAt: string;
  revoked: boolean;
}

export interface LoginAttemptState {
  failedAttempts: number;
  lockedUntil: string | null;
  lastAttemptAt: string | null;
}

export type AuditEvent = "grant_approved" | "grant_denied" | "grant_revoked" | "pat_created" | "pat_revoked";

export interface AuditLogEntry {
  at: string;
  event: AuditEvent;
  clientId: string;
  clientName: string;
}

/**
 * A personal access token (spec 013): an owner-generated, non-expiring
 * bearer credential for authenticating to the MCP server without an OAuth
 * flow. `id` is a non-secret identifier used in the settings UI, the revoke
 * route, and audit log entries; the actual secret bearer value is never
 * stored on this record (see PersonalAccessTokenValue, data-model.md §2).
 */
export interface PersonalAccessToken {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
  revoked: boolean;
  revokedAt: string | null;
}

/**
 * Pointer record keyed by the secret bearer value itself
 * (`.oauth/pat-values/{value}.json`), resolving to the non-secret `id` of its
 * PersonalAccessToken record — keeps the hot MCP-auth lookup a single direct
 * key read without ever storing the secret inside the listable record.
 */
export interface PersonalAccessTokenValue {
  id: string;
}
