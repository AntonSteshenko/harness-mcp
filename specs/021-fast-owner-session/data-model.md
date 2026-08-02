# Data Model: Fast Owner Session Validation

This feature replaces one persisted entity's *shape* (the owner session record) with a smaller, differently-purposed one, and adds a signed client-side cookie whose payload is never itself persisted server-side.

## Owner Session Cookie (client-held, replaces today's opaque session ID)

Today (`lib/oauth/session.ts`), the `oauth_owner_session` cookie holds only an opaque `sessionId`, and the actual session data lives server-side in S3 at `owner-sessions/{sessionId}`, fetched on every request.

**New shape** — the cookie value itself becomes `base64url(payload).signature`, where:

```ts
interface OwnerSessionPayload {
  generation: number;   // must equal the current generation record's value
  issuedAt: string;     // ISO 8601
  expiresAt: string;    // ISO 8601 — 12 hours from issuedAt by default (spec Assumption)
}
```

- `signature` = `HMAC-SHA256(base64url(payload), currentSecret)`, hex-encoded.
- Nothing here is confidential (no credentials, no PII) — the signature is for tamper-evidence, not to hide the payload. No server-side record of this cookie's existence is kept once issued.

**Lifecycle**: created by `createOwnerSession()` on successful sign-in (`app/oauth/login/submit/route.ts`, unchanged call site). Verified locally by `hasActiveOwnerSession()`/`requireOwnerSession()` on every subsequent request: decode → recompute signature → compare (`crypto.timingSafeEqual`) → check `generation` against the current generation record → check `expiresAt` against now. Any failure at any step is treated identically to "no session."

**Renewal (FR-007)**: on each successful validation with more than half the TTL elapsed, the response re-issues a fresh cookie with a new `issuedAt`/`expiresAt`, so an actively-working owner's session keeps sliding forward and isn't cut off mid-task; an idle owner's cookie simply reaches `expiresAt` with no renewal in between.

## Generation Record (server-side, replaces the per-session `owner-sessions/{id}` records)

Persisted at `.oauth/session-generation.json` via the existing `getRecord`/`putRecord` helpers (`lib/oauth/store.ts`) — one record total, not one per session:

```ts
interface SessionGenerationRecord {
  secret: string;       // random, generated once on first use
  generation: number;   // starts at 0; incremented by sign-out
}
```

**Lifecycle**: created lazily on first `createOwnerSession()` call if it doesn't yet exist. Read (via the in-memory cache below) whenever a cookie is signed or verified. Updated (generation += 1, secret unchanged) by `POST /oauth/logout`.

**Replaces**: the current one-record-per-session `owner-sessions/{sessionId}` objects, which are no longer written or read after this change (existing stale records may be left in place or cleaned up opportunistically — not required for correctness, since nothing reads them anymore).

## In-Memory Generation Cache (per warm serverless instance, new)

Not persisted — module-level state in `lib/oauth/sessionSecret.ts`, scoped to one running instance:

```ts
interface CachedGeneration {
  record: SessionGenerationRecord;
  fetchedAt: number;   // Date.now() at fetch time
}
```

**Lifecycle**: `getCurrentGeneration()` returns the cached record if `Date.now() - fetchedAt < 30_000`; otherwise it re-fetches from the store, updates the cache, and returns the fresh value. This is what removes the per-request storage round trip (FR-001) while bounding sign-out propagation delay to the cache TTL (research.md §3).

## State Transitions

```
                     sign-in                          sign-out
   (no session) ─────────────────► (valid session) ─────────────────► (rejected: generation mismatch)
        ▲                                │
        │                                │ expiresAt reached
        └────────────────────────────────┘
```

No entity here has more than these states; there is no "pending"/"revoked-but-not-yet-expired" intermediate state modeled explicitly — a session is either verifiable against the current generation and unexpired, or it is treated as absent.
