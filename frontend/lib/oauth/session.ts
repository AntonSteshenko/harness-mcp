import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getRecord, putRecord } from "./store";

/**
 * The owner's sign-in session (data-model.md OwnerCredential) — gates the
 * consent-approval action and the connected-clients management pages.
 * Opaque session ID looked up server-side, mirroring the OAuth Token design
 * (research.md §5) rather than a self-contained signed cookie.
 */
interface OwnerSession {
  sessionId: string;
  createdAt: string;
  expiresAt: string;
}

const COOKIE_NAME = "oauth_owner_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

/** Establishes a new owner session and sets its cookie on the current response. */
export async function createOwnerSession(): Promise<void> {
  const sessionId = randomBytes(32).toString("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

  await putRecord<OwnerSession>(`owner-sessions/${sessionId}`, {
    sessionId,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  });

  const store = await cookies();
  store.set(COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Whether the current request carries a still-valid owner session. */
export async function hasActiveOwnerSession(): Promise<boolean> {
  const store = await cookies();
  const sessionId = store.get(COOKIE_NAME)?.value;
  if (!sessionId) return false;

  const session = await getRecord<OwnerSession>(`owner-sessions/${sessionId}`);
  if (!session) return false;

  return new Date(session.expiresAt).getTime() > Date.now();
}
