import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { verifyPersonalAccessToken } from "./personalAccessTokens";
import { getCurrentGeneration } from "./sessionSecret";
import { verifyAccessToken } from "./tokens";

/**
 * The owner's sign-in session — gates the consent-approval action, the
 * connected-clients management pages, and the file editor (spec 009).
 * Self-contained, HMAC-signed cookie (data-model.md "Owner Session Cookie")
 * verified locally with no storage round trip per request (021,
 * research.md §1) — replaces the earlier design of an opaque session ID
 * looked up server-side on every request.
 */
interface OwnerSessionPayload {
  generation: number;
  issuedAt: string;
  expiresAt: string;
}

const COOKIE_NAME = "oauth_owner_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function sign(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(encodedPayload).digest("hex");
}

function encodeCookie(payload: OwnerSessionPayload, secret: string): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload, secret)}`;
}

/** Decodes and verifies a cookie value, or returns `null` on any tamper/format/parse failure. */
function decodeCookie(cookieValue: string, secret: string): OwnerSessionPayload | null {
  const parts = cookieValue.split(".");
  if (parts.length !== 2) return null;
  const [encodedPayload, signatureHex] = parts;

  const expectedSignature = sign(encodedPayload, secret);
  const actual = Buffer.from(signatureHex, "hex");
  const expected = Buffer.from(expectedSignature, "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString()) as OwnerSessionPayload;
    if (typeof payload.generation !== "number" || typeof payload.expiresAt !== "string" || typeof payload.issuedAt !== "string") {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

async function issueSessionCookie(generation: number): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  const payload: OwnerSessionPayload = { generation, issuedAt: now.toISOString(), expiresAt: expiresAt.toISOString() };

  const { secret } = await getCurrentGeneration();
  const store = await cookies();
  store.set(COOKIE_NAME, encodeCookie(payload, secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Establishes a new owner session and sets its cookie on the current response. */
export async function createOwnerSession(): Promise<void> {
  const { generation } = await getCurrentGeneration();
  await issueSessionCookie(generation);
}

/** Reads and verifies the current request's session cookie, or `null` if absent/invalid/expired. */
async function readSessionPayload(): Promise<OwnerSessionPayload | null> {
  const store = await cookies();
  const cookieValue = store.get(COOKIE_NAME)?.value;
  if (!cookieValue) return null;

  const { secret, generation } = await getCurrentGeneration();
  const payload = decodeCookie(cookieValue, secret);
  if (!payload) return null;
  if (payload.generation !== generation) return null;
  if (new Date(payload.expiresAt).getTime() <= Date.now()) return null;

  return payload;
}

/** Whether the current request carries a still-valid owner session. */
export async function hasActiveOwnerSession(): Promise<boolean> {
  return (await readSessionPayload()) !== null;
}

/**
 * Whether the current request's `Authorization` header carries a still-valid
 * OAuth access token or personal access token — tried in that order, the
 * same fallback chain already used by the MCP endpoint (spec 013). Lets an
 * external application call the file API server-to-server with a token
 * instead of a browser session (spec 027).
 */
async function hasValidBearerToken(): Promise<boolean> {
  const headerStore = await headers();
  const authHeader = headerStore.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;

  const token = authHeader.slice("Bearer ".length);
  const authInfo = (await verifyAccessToken(token)) ?? (await verifyPersonalAccessToken(token));
  return authInfo !== undefined;
}

/**
 * Guard for API route handlers: returns a 401 response when there's no
 * active owner session and no valid bearer token, or `null` when the caller
 * may proceed — renewing the session cookie along the way if it's more than
 * halfway to expiry, so an actively-working owner is never cut off mid-task
 * (FR-007). Used by the editor's file endpoints (spec 009).
 *
 * The bearer-token fallback (spec 027) is only checked when there's no
 * valid session cookie, so cookie-authenticated requests are unaffected and
 * pay no extra token-verification cost.
 *
 * Renewal only happens for the cookie path, not in `hasActiveOwnerSession()`:
 * this function is only ever called from Route Handlers, where setting a
 * cookie is valid; `hasActiveOwnerSession()` is also called directly from
 * plain Server Components (e.g. `app/files/layout.tsx`), where Next.js
 * forbids mutating cookies during render.
 */
export async function requireOwnerSession(): Promise<NextResponse | null> {
  const payload = await readSessionPayload();
  if (payload) {
    const elapsed = Date.now() - new Date(payload.issuedAt).getTime();
    if (elapsed > SESSION_TTL_MS / 2) {
      await issueSessionCookie(payload.generation);
    }
    return null;
  }

  if (await hasValidBearerToken()) return null;

  return NextResponse.json({ code: "unauthorized", message: "Sign in required" }, { status: 401 });
}
