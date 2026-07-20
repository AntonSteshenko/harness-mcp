# Phase 0 Research: Configurable S3-Compatible Storage Connection

## 1. Where the real `.env` file needs to live

**Decision**: Add a new `frontend/.env.example` documenting the app-level `S3_*` connection variables. Leave the existing repo-root `.env.example` untouched — it continues to document the `docker-compose.yml`/MinIO-container variables (`MINIO_API_PORT`, `MINIO_CONSOLE_PORT`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`).

**Rationale**: Spec 006's research (§4) already flagged that Next.js only auto-loads `.env*` files from its own project root, and since spec 006 moved the app into `frontend/`, that project root is `frontend/`, not the repo root — a root-level `.env`/`.env.local` is invisible to the Next.js process. That was a documented-but-not-fixed limitation before, because every var the app read had a hardcoded fallback matching `docker-compose.yml`'s fixed defaults, so the app worked with zero `.env` file present. This feature removes that safety net on purpose (FR-004 requires failing fast when required values are absent), so the app now needs a real, loadable `.env`/`.env.local` inside `frontend/`. The two `.env.example` files intentionally document non-overlapping variables (container operation vs. app connection), so keeping both does not create the drift risk spec 006 rejected when it considered simply duplicating one file.

**Alternatives considered**: Moving the root `.env.example` into `frontend/` and merging both concerns into one file — rejected because `docker-compose.yml` (which runs from the repo root) auto-loads its own `.env` from the repo root, not from `frontend/`; merging the files would require operators to place one file in two different tools' expected locations, which is more confusing than two small, clearly-scoped files.

## 2. Startup validation mechanism (FR-004, FR-005)

**Decision**: Add `frontend/instrumentation.ts` with a `register()` function that loads and validates the storage configuration and performs a connectivity/credential/bucket check, throwing if anything is wrong. Next.js (stable since v15, present in this project's v16.2.10) calls `register()` exactly once per server instance, for both `next dev` and `next start`, before the app starts serving requests.

**Rationale**: This is the only place in a standard Next.js app that runs code once at boot rather than lazily on first request or per-request. It matches FR-004/FR-005's "at startup" language precisely, and an uncaught error thrown from `register()` stops the server from coming up, giving the fail-fast behavior spec.md's User Story 2 describes without introducing a custom entrypoint/server wrapper.

**Alternatives considered**: Validating lazily on first storage operation (the previous `ensureBucket()` pattern) — rejected because it means a misconfigured server appears to start successfully and only fails once a user or MCP client happens to touch storage, which is exactly the confusing-late-failure mode FR-005 exists to prevent. A custom Node.js entrypoint wrapping `next start` — rejected as unnecessary complexity now that `instrumentation.ts` is a first-class, stable Next.js feature that covers both `dev` and `start`.

## 3. Bucket existence: fail-fast vs. auto-create

**Decision**: Remove `client.ts`'s current auto-create-on-missing-bucket fallback. The startup check requires the configured bucket to already exist; if it doesn't, the system fails with a clear "bucket not found" error (matching spec.md's edge case) instead of silently creating one. Local development gets a one-time manual bucket-creation step, documented in quickstart.md.

**Rationale**: Auto-creating buckets is a reasonable convenience for a single, project-owned local MinIO instance, but it's unsafe/impossible as a default once "any S3-compatible provider" is in scope: a real cloud account may intentionally withhold `CreateBucket` permission from the credentials it issues, and silently attempting to create a bucket on someone else's infrastructure the first time the app runs is surprising behavior for a generic connection feature. It also directly contradicts spec 001's own original decision (documented in its Clarifications) that bucket creation is left entirely to the developer, not automated — the existing `ensureBucket()` auto-create was implementation drift beyond that decision, introduced for local-dev convenience in spec 002.

**Alternatives considered**: Keeping auto-create as the default, with an opt-out flag for "strict" providers — rejected as unnecessary extra configuration surface for a behavior spec.md's own edge cases already resolve in the fail-fast direction; an opt-in "auto-create" flag could be revisited later if local-dev friction turns out to matter in practice, but nothing in the spec calls for it now.

## 4. Path-style vs. virtual-hosted-style addressing (FR-012)

**Decision**: Add a `S3_FORCE_PATH_STYLE` environment variable (`"true"`/`"false"`, default `"true"`) mapped directly to the AWS SDK v3 `S3Client`'s existing `forcePathStyle` constructor option.

**Rationale**: `@aws-sdk/client-s3`'s `S3Client` already exposes exactly this switch — `client.ts` today hardcodes `forcePathStyle: true` for MinIO. Exposing the existing option as an env var, rather than trying to auto-detect it, is the smallest change that satisfies the clarification's "selectable via explicit configuration setting" answer; defaulting to `true` preserves today's local-MinIO behavior with zero required changes to the existing `.env` values a developer already has.

**Alternatives considered**: Auto-detecting addressing style from the endpoint hostname (e.g. treating anything that isn't a well-known cloud provider domain as path-style) — rejected per the clarification session, which explicitly chose an explicit config setting over auto-detection to avoid guessing wrong for less common providers.

## 5. HTTP vs. HTTPS endpoints (FR-011)

**Decision**: No dedicated scheme flag — the scheme is simply part of the `S3_ENDPOINT` URL value (`http://...` or `https://...`), exactly as the AWS SDK v3 client already interprets its `endpoint` option today.

**Rationale**: `S3Client`'s `endpoint` option is parsed as a full URL including scheme; the client already sends plaintext requests to `http://localhost:9000` today (current hardcoded value) and would send TLS requests automatically the moment the URL's scheme is `https://`. This satisfies the clarification's answer ("TLS enforced only when the operator configures an `https://` endpoint; no separate flag") with no code beyond what constructing the client from `S3_ENDPOINT` already requires.

**Alternatives considered**: A separate `S3_USE_TLS` boolean — rejected as redundant; it would let the scheme in `S3_ENDPOINT` and a separate flag disagree, creating an ambiguity the clarification specifically avoided by tying TLS directly to the URL scheme.

## 6. Secret handling in logs and error messages (FR-008)

**Decision**: Startup log/error messages reference configuration problems by **env var name** only (e.g. "S3_SECRET_ACCESS_KEY is not set", "credentials rejected by S3_ENDPOINT"), never by value. A successful startup may log non-secret identifiers (endpoint host, bucket name, region) but never `accessKeyId`/`secretAccessKey`.

**Rationale**: Directly satisfies FR-008. Naming the offending variable (rather than showing its value or omitting it entirely) keeps the fail-fast error actionable (SC-002) without any risk of a secret ending up in process logs.

**Alternatives considered**: Logging a masked/partial secret (e.g. last 4 characters) for debugging convenience — rejected as unnecessary risk for a feature where the failure is "value missing" or "value rejected," neither of which requires seeing any part of the actual secret to diagnose.

## 7. Config loading must never throw at module-import time

**Decision**: Split config handling into two functions — `readStorageConfig()` (reads env vars with defaults, tolerates missing/malformed values, never throws) used at `client.ts` module scope to construct `s3Client`/`BUCKET`; and `validateStorageConfig()` (throws `StorageConfigError` for missing/invalid fields) called only from inside `verifyStorageConnection()`, which itself is only invoked by `instrumentation.ts`'s `register()`.

**Rationale**: Discovered empirically while validating the build: `next build` executes a "Collecting page data" step that imports every route module (including `app/api/file/route.ts`, which transitively imports `lib/storage/client.ts`) to inspect its exports, even though it never calls the route handler function itself. An initial version of this feature called the validating loader directly at `client.ts`'s module scope, which made `next build` fail immediately whenever `S3_*` env vars weren't present in the build environment — a much stronger requirement than FR-004/FR-005 intend ("at startup," i.e. `next start`/`next dev`, not "at every `next build`, even on unrelated machines/CI without real credentials"). Separating "read" (always safe) from "validate" (only called at real startup) fixes this while keeping `s3Client`/`BUCKET` as simple eagerly-exported values, so every existing call site (`files.ts`, `directories.ts`, `move.ts`, `paths.ts`) needs no change to how it imports/uses them.

**Alternatives considered**: Making `s3Client`/`BUCKET` lazy (functions/getters instead of plain exports) so nothing is read or validated until first actual use — rejected as a much larger, riskier change touching every existing call site in `lib/storage/*` for a problem the read/validate split already solves with zero call-site changes. Setting placeholder `S3_*` env vars during CI/build — rejected as fragile (relies on every future build environment remembering to set fake values) compared to a design that simply doesn't need them at build time.
