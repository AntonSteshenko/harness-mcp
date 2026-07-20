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

export type AuditEvent = "grant_approved" | "grant_denied" | "grant_revoked";

export interface AuditLogEntry {
  at: string;
  event: AuditEvent;
  clientId: string;
  clientName: string;
}
