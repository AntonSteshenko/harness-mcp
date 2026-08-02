# Phase 0 Research: Fast Owner Session Validation

## 1. How to make a session verifiable without a storage round trip

**Decision**: Replace the opaque `sessionId` cookie (currently looked up via `getRecord()` in S3 on every request) with a self-contained cookie whose payload is `{ ownerId, generation, issuedAt, expiresAt }`, base64url-encoded, with an HMAC-SHA256 signature appended (`payload.signature`, à la a minimal JWT). Verification is: base64url-decode, recompute the HMAC over the payload with the current secret, compare in constant time, then check `expiresAt` — all pure computation, no network or storage call.

**Rationale**: `node:crypto`'s `createHmac`/`timingSafeEqual` are built into Node.js — no new dependency, consistent with this codebase's existing preference for built-ins (`randomBytes` is already used in `lib/oauth/session.ts`). A hand-rolled signed payload is sufficient here: the only claims needed are expiry and the generation number, so a full JWT library (`jose`, etc.) would add a dependency for structure this project doesn't need.

**Alternatives considered**:
- **`jose` (JWT/JWS library)**: More standard, but pulls in a dependency purely for a token shape this feature doesn't need (single owner, two claims, one signing algorithm, no third-party verifiers).
- **`iron-session` (encrypted, sealed cookies)**: Encrypts rather than just signs. Unnecessary here — the payload (an internal owner-id constant, a small integer generation, two timestamps) has no confidentiality requirement, only tamper-evidence. Encryption would be extra CPU and a dependency for no benefit.

## 2. How "sign out everywhere" works without tracking individual sessions

**Decision**: Introduce one small **generation record**, `{ secret: string, generation: number }`, persisted at `.oauth/session-generation.json` via the existing `getRecord`/`putRecord` helpers in `lib/oauth/store.ts` (same convention as every other piece of OAuth state). `createOwnerSession()` reads the current record (creating it on first use, with `generation: 0` and a freshly generated random secret) and signs the new cookie with that secret, embedding the current `generation` in the payload. Signing out increments `generation` in place (same `secret`) and writes the record back. Verification rejects any cookie whose embedded `generation` doesn't match the current record's `generation` — so every cookie issued before a sign-out is rejected the moment the verifying instance observes the bumped generation, without the system ever having recorded *which* sessions existed.

**Rationale**: This is the smallest mechanism that satisfies FR-004/FR-005 (invalidate every previously issued credential at once, without per-session tracking). Bumping `generation` rather than replacing `secret` keeps verification logic uniform (always: fetch current record, compare secret for the HMAC and generation for the check) and avoids re-deriving anything.

**Alternatives considered**:
- **Rotate the secret itself on sign-out (no separate generation field)**: Equivalent in effect, but conflates "the key used to check the signature" with "the version being checked," which makes it marginally harder to reason about/log ("generation 4" is a clearer audit trail entry than a rotated hex string). Rejected in favor of the clearer explicit counter.
- **Per-session revocation list** (store a set of valid/invalid session IDs): This is exactly the "track individual sessions" approach FR-005 rules out, and it's what today's `getRecord()`-per-request design already does — the thing being replaced.

## 3. Reconciling "no per-request lookup" with "immediate" revocation

**Tension**: FR-001 requires no network/storage round trip dedicated to session validation on every request. FR-004/SC-002 require sign-out to take effect "immediately," not "eventually." These pull in opposite directions if taken to their logical extremes — genuinely zero-latency, globally-consistent revocation with zero per-request network cost isn't achievable simultaneously in a distributed serverless deployment (Vercel Fluid Compute reuses warm instances across regions/invocations; there's no single in-memory source of truth all of them share instantly).

**Decision**: Cache the generation record in **module-level memory** per warm serverless instance, with a short TTL (30 seconds). Every request checks the in-memory copy (no I/O at all in the common case); the record is only re-fetched from S3 when the cached copy is older than the TTL. This means:
- A cold/new instance always fetches the current record on its first request — sign-out is instant there.
- A warm instance that already cached the pre-sign-out generation keeps accepting old-generation cookies for **up to 30 seconds** after a sign-out elsewhere, then re-fetches and starts rejecting them.

This resolves the tension by accepting a small, bounded worst-case delay (≤30s, only affecting instances that were already warm at the exact moment of sign-out) in exchange for making the overwhelmingly common case — validating an already-valid session — completely free of network I/O. This is the practical reading of SC-002 ("immediately," "not eventually waiting for the session's 12-hour TTL") adopted for this plan: bounded to seconds, not to the remainder of the session's natural lifetime.

**Rationale**: 30 seconds keeps the exposure window for the edge case (sign-out racing an already-warm instance) small and human-scale, while still cutting the per-request S3 call rate by multiple orders of magnitude — one cheap read per warm instance per 30s, not one per request, which is what actually drives the reported 2-3s file-open delay.

**Alternatives considered**:
- **Vercel Edge Config / KV for the generation record**: Genuinely lower propagation delay (typically low single-digit seconds, globally replicated) and would still avoid a per-request S3-style round trip. Rejected for this iteration only because it introduces a new platform dependency/integration for a single-owner app where a 30-second bound is already acceptable; noted here as the natural next step if the bound ever needs tightening.
- **No caching (re-check generation every request)**: Would fully satisfy "immediate" but reintroduces exactly the per-request storage round trip this feature exists to remove — defeats the purpose.

## 4. Handling sessions issued before this change ships

**Decision**: The old cookie (`oauth_owner_session`, an opaque hex session ID) and the new cookie can share the same cookie name (`oauth_owner_session`), since the new verifier will simply fail to parse/verify an old-format value (no `.`-separated payload/signature, or a signature check that fails) and treat it as "no valid session" — the same outcome as spec 009's existing "no session" path (redirect to sign-in / `401`). No explicit migration code is needed; this falls directly out of verification failing closed by default.

**Rationale**: Matches the spec's Assumption ("a brief, one-time re-login is acceptable") with the least code — a dedicated migration path would be more code to achieve an already-acceptable outcome.

## 5. Sign-out entry point

**Decision**: Add `POST /oauth/logout` (`app/oauth/logout/route.ts`), which bumps the generation record and clears the cookie, then redirects to the sign-in page. Add a "Sign out" control to `app/settings/connected-apps/page.tsx` (the existing owner-only settings page) since no sign-out UI exists anywhere today.

**Rationale**: Spec 009 never added a sign-out flow (sessions only ever expired on their own TTL) — User Story 2 of this feature is genuinely new functionality, not a replacement of something existing, and needs an entry point.
