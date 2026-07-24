import { randomBytes } from "node:crypto";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { getRecord, listRecords, putRecord } from "./store";
import type { PersonalAccessToken, PersonalAccessTokenValue } from "./types";

export interface CreatedPersonalAccessToken {
  record: PersonalAccessToken;
  /** Shown to the owner exactly once by the caller (FR-002) — never persisted in a listable form. */
  secretValue: string;
}

/** Creates a named, non-expiring personal access token (FR-001, FR-002, data-model.md). */
export async function createPersonalAccessToken(name: string): Promise<CreatedPersonalAccessToken> {
  const id = randomBytes(8).toString("hex");
  const secretValue = randomBytes(32).toString("hex");
  const now = new Date().toISOString();

  const record: PersonalAccessToken = {
    id,
    name,
    createdAt: now,
    lastUsedAt: null,
    revoked: false,
    revokedAt: null,
  };

  await Promise.all([
    putRecord<PersonalAccessToken>(`pats/${id}`, record),
    putRecord<PersonalAccessTokenValue>(`pat-values/${secretValue}`, { id }),
  ]);

  return { record, secretValue };
}

/** Lists every personal access token (never their secret values) — FR-005. */
export async function listPersonalAccessTokens(): Promise<PersonalAccessToken[]> {
  return listRecords<PersonalAccessToken>("pats/");
}

/** Revokes a personal access token by its non-secret id; a no-op if already revoked or unknown (FR-006, FR-007). */
export async function revokePersonalAccessToken(id: string): Promise<void> {
  const record = await getRecord<PersonalAccessToken>(`pats/${id}`);
  if (!record || record.revoked) return;

  await putRecord<PersonalAccessToken>(`pats/${id}`, {
    ...record,
    revoked: true,
    revokedAt: new Date().toISOString(),
  });
}

/**
 * Verifies a bearer token for mcp-handler's withMcpAuth, as a fallback
 * alongside verifyAccessToken (FR-003, FR-004, research.md §3). On success,
 * updates the token's lastUsedAt (FR-005). Never expires (FR-010), so
 * `expiresAt` is omitted from the returned AuthInfo.
 */
export async function verifyPersonalAccessToken(secretValue: string): Promise<AuthInfo | undefined> {
  const pointer = await getRecord<PersonalAccessTokenValue>(`pat-values/${secretValue}`);
  if (!pointer) return undefined;

  const record = await getRecord<PersonalAccessToken>(`pats/${pointer.id}`);
  if (!record || record.revoked) return undefined;

  await putRecord<PersonalAccessToken>(`pats/${pointer.id}`, {
    ...record,
    lastUsedAt: new Date().toISOString(),
  });

  return {
    token: secretValue,
    clientId: `pat:${record.id}`,
    scopes: ["full_access"],
  };
}
