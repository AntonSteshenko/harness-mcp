import { randomBytes } from "node:crypto";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { getRecord, putRecord } from "./store";
import type { AuthorizationGrant, Token } from "./types";

const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const REFRESH_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

interface TokenPairIndex {
  accessTokenId: string;
  refreshTokenId: string;
}

function generateOpaqueToken(): string {
  return randomBytes(32).toString("hex");
}

export interface IssuedTokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
}

/** Issues a fresh access/refresh token pair under a grant (data-model.md Token). */
export async function issueTokenPair(grantId: string, clientId: string): Promise<IssuedTokenPair> {
  const pairId = randomBytes(16).toString("hex");
  const now = new Date();
  const accessToken = generateOpaqueToken();
  const refreshToken = generateOpaqueToken();

  const base = { pairId, grantId, clientId, issuedAt: now.toISOString(), revoked: false };
  const accessRecord: Token = {
    ...base,
    tokenId: accessToken,
    kind: "access",
    expiresAt: new Date(now.getTime() + ACCESS_TOKEN_TTL_MS).toISOString(),
  };
  const refreshRecord: Token = {
    ...base,
    tokenId: refreshToken,
    kind: "refresh",
    expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS).toISOString(),
  };

  await Promise.all([
    putRecord<Token>(`tokens/${accessToken}`, accessRecord),
    putRecord<Token>(`tokens/${refreshToken}`, refreshRecord),
    putRecord<TokenPairIndex>(`pairs/${pairId}`, { accessTokenId: accessToken, refreshTokenId: refreshToken }),
  ]);

  return { accessToken, refreshToken, expiresIn: Math.floor(ACCESS_TOKEN_TTL_MS / 1000) };
}

/**
 * Verifies a bearer token for mcp-handler's withMcpAuth (research.md §1).
 * Checks the token itself (exists, unrevoked, unexpired) and its parent
 * grant's status (FR-001, FR-007, data-model.md validation rules); on
 * success, updates the grant's lastUsedAt (FR-006).
 */
export async function verifyAccessToken(token: string): Promise<AuthInfo | undefined> {
  const record = await getRecord<Token>(`tokens/${token}`);
  if (!record || record.kind !== "access") return undefined;
  if (record.revoked) return undefined;
  if (new Date(record.expiresAt).getTime() <= Date.now()) return undefined;

  const grant = await getRecord<AuthorizationGrant>(`grants/${record.grantId}`);
  if (!grant || grant.status !== "active") return undefined;

  await putRecord<AuthorizationGrant>(`grants/${record.grantId}`, {
    ...grant,
    lastUsedAt: new Date().toISOString(),
  });

  return {
    token,
    clientId: record.clientId,
    scopes: ["full_access"],
    expiresAt: Math.floor(new Date(record.expiresAt).getTime() / 1000),
  };
}

/** Looks up a refresh token, returning it only if usable (unrevoked, unexpired, grant active). */
export async function getUsableRefreshToken(token: string): Promise<Token | undefined> {
  const record = await getRecord<Token>(`tokens/${token}`);
  if (!record || record.kind !== "refresh") return undefined;
  if (record.revoked) return undefined;
  if (new Date(record.expiresAt).getTime() <= Date.now()) return undefined;

  const grant = await getRecord<AuthorizationGrant>(`grants/${record.grantId}`);
  if (!grant || grant.status !== "active") return undefined;

  return record;
}

/**
 * Revokes a token and its paired counterpart (RFC 7009, FR-005). An
 * already-invalid/unknown token is treated as successfully revoked, per
 * RFC 7009 §2.2.
 */
export async function revokeTokenPair(token: string): Promise<void> {
  const record = await getRecord<Token>(`tokens/${token}`);
  if (!record) return;

  const pair = await getRecord<TokenPairIndex>(`pairs/${record.pairId}`);
  const idsToRevoke = pair ? [pair.accessTokenId, pair.refreshTokenId] : [record.tokenId];

  await Promise.all(
    idsToRevoke.map(async (tokenId) => {
      const t = await getRecord<Token>(`tokens/${tokenId}`);
      if (t && !t.revoked) {
        await putRecord<Token>(`tokens/${tokenId}`, { ...t, revoked: true });
      }
    }),
  );
}
