# Research: S3 Storage MCP Server

**Input**: [spec.md](./spec.md) — Clarifications session 2026-07-19, user request to build on Next.js

All unknowns from the Technical Context have been resolved below; no `NEEDS CLARIFICATION` markers remain.

## 1. Feasibility of an MCP server on Next.js

**Decision**: Yes — implement the MCP server as a single Next.js Route Handler using the `mcp-handler` package (Vercel's official adapter over the `@modelcontextprotocol/sdk`), exposed via the Streamable HTTP transport.

**Rationale**: The user asked whether this feature could be built entirely on Next.js. MCP servers don't require a specific runtime — they need a process that speaks the MCP protocol over some transport (stdio, SSE, or Streamable HTTP). Next.js Route Handlers can implement the Streamable HTTP transport directly, and `mcp-handler` wraps the official TypeScript MCP SDK so tool definitions (name, input schema via Zod, handler function) plug straight into a Next.js route without hand-rolling the protocol/session/framing logic. This keeps the entire feature — server process, routing, tool logic — inside one Next.js app, matching the request.

**Alternatives considered**:
- A standalone Node.js process using `@modelcontextprotocol/sdk`'s stdio transport — the traditional MCP server pattern (e.g. how most local MCP servers, including this project's own Claude Code tooling, are launched), but explicitly not what was asked for here.
- Hand-rolling the Streamable HTTP transport directly against the raw MCP SDK in a Route Handler — works, but `mcp-handler` already solves the session/transport plumbing and is maintained by Vercel specifically for this Next.js use case, so reimplementing it would be pure extra risk for no benefit.

## 2. Storage client

**Decision**: Use `@aws-sdk/client-s3` (AWS SDK for JavaScript v3), configured with `endpoint: http://localhost:<MINIO_API_PORT>`, `forcePathStyle: true`, and the fixed local credentials from spec 001 (`MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`, both `minioadmin` by default).

**Rationale**: MinIO (spec 001) is S3-API-compatible, so the standard AWS SDK works against it unmodified once pointed at the local endpoint with path-style addressing (MinIO requires `forcePathStyle: true` since it doesn't support virtual-hosted-style bucket addressing by default in a local setup). This avoids introducing a MinIO-specific client when the whole point of spec 001 was standard S3 compatibility.

**Alternatives considered**:
- MinIO's own JavaScript SDK (`minio` npm package) — works but is MinIO-specific; the AWS SDK keeps the storage-access layer portable to any S3-compatible backend, consistent with spec 001's "S3-compatible" framing.

## 3. Directory emulation on top of S3

**Decision**: Represent a directory as a common key prefix ending in `/`. An **explicitly created empty directory** (FR-007) is persisted as a zero-byte object whose key is the directory path plus a trailing `/` (e.g. `notes/`) — the same convention used by the AWS Console and most S3 tooling for "folders." Listing a directory uses the S3 `ListObjectsV2` API with `Delimiter: "/"` and the directory's path as `Prefix`, which returns immediate child objects (files) and `CommonPrefixes` (child directories) in one call — exactly the "direct contents only, no flattening" behavior required by spec 001's US2 acceptance scenario 1.

**Rationale**: This is the standard, well-documented pattern for emulating a filesystem over S3 and satisfies every directory-related FR without inventing new storage semantics. `Delimiter: "/"` is what makes `CommonPrefixes` do the "one level at a time" grouping instead of returning every nested key flattened.

**Alternatives considered**:
- Treating directories as purely implicit (no marker object, they "exist" only while they contain something) — this was the original spec draft but was superseded by the clarification that empty directories must persist (spec 001... i.e. spec 002 FR-007), so it's not viable as-is.
- A separate metadata store (e.g. a manifest object) tracking the directory tree — unnecessary complexity; S3 prefix listing already gives correct, storage-native results.

## 4. Recursive directory delete

**Decision**: Recursive delete (FR-008) is implemented by listing all objects under the directory's prefix (paginating `ListObjectsV2` without a delimiter, so it returns every nested key) and issuing a batched `DeleteObjects` call (up to 1000 keys per batch, looping for more).

**Rationale**: `DeleteObjects` is the standard bulk-delete S3 operation and avoids one round trip per file, keeping deletes of directories with many files reasonably fast (SC-003's "delete 100 files, zero orphans" target).

**Alternatives considered**:
- Deleting objects one at a time in a loop — simpler code but far more round trips; batched delete is a well-established, low-risk optimization directly supported by the S3 API, not a speculative one.

## 5. Move/rename semantics

**Decision**: S3 has no native rename/move operation. A move (FR-009/FR-010) is implemented as copy-then-delete: `CopyObject` (or `CopyObject` per key for a directory's full recursive listing) to the new key(s), followed by `DeleteObjects` of the old key(s) once every copy has succeeded.

**Rationale**: This is the standard way to "move" objects in S3-compatible storage. Doing all copies before any deletes minimizes the window in which a partially-moved directory could leave orphaned or duplicated content if an individual copy fails.

**Alternatives considered**:
- Delete-then-copy — rejected: a failure between steps would destroy data with nothing yet in place at the new location, which is strictly worse than a transient duplicate.

## 6. Concurrency handling

**Decision**: No locking or optimistic-concurrency checks are implemented, matching the clarified single-active-client assumption (FR-015). Each MCP tool call runs its S3 operations to completion sequentially within that call.

**Rationale**: Directly implements the clarification answer — the MCP server is used within one session by one client at a time, so the rare true race is an accepted, documented tradeoff rather than something requiring engineering effort.

**Alternatives considered**:
- S3 conditional writes (`If-Match`/`IfNoneMatch` style preconditions) for optimistic concurrency — explicitly out of scope per the clarification (Option A chosen over B/C).

## 7. Local dev workflow (not containerized)

**Decision**: The MCP server runs as a standard Next.js app via `next dev` (development) / `next build && next start` (production-like local run) — it is **not** added as a Docker Compose service.

**Rationale**: Next.js's dev-time value (Fast Refresh, in-process debugging, standard Node.js tooling) is best experienced running natively rather than rebuilding a container image on every change. It still depends on the spec 001 MinIO service being up (via `docker compose up -d` in that project), but the two run as independent local processes, connected only over `http://localhost:<MINIO_API_PORT>`.

**Alternatives considered**:
- Adding a `nextjs-mcp` service to the existing `docker-compose.yml` — would keep "everything in one `docker compose up`," but reintroduces the container rebuild/HMR-over-volume-mount friction Next.js dev workflows are known for; not requested by the user and not necessary since the two services only need network reachability, which `localhost` already provides.

## 8. Package manager & baseline tooling

**Decision**: npm, with a standard `create-next-app`-equivalent TypeScript + App Router project structure (`app/` directory, `tsconfig.json` strict mode).

**Rationale**: No package manager preference was stated anywhere in this project; npm ships with Node.js by default and requires no extra assumptions about what's installed on a given developer's machine.

**Alternatives considered**:
- pnpm/yarn — common in Vercel-centric projects, but would assume a global install the user hasn't confirmed; npm is the zero-assumption default.

## 9. Validation approach

**Decision**: Validate via a scripted MCP client call sequence documented in `quickstart.md` (using the MCP TypeScript SDK's client, or a simple `curl`-based Streamable HTTP exchange) exercising each spec acceptance scenario end-to-end against a running `next dev` instance plus the spec 001 MinIO stack — no formal automated test suite, consistent with spec 002 not requesting tests.

**Rationale**: Mirrors the validation approach already established in spec 001 (research.md §6 there) for consistency across this project, and matches the instruction that tests are optional unless requested.

**Alternatives considered**:
- Vitest/Jest unit tests around the storage-adapter functions — a reasonable future addition (tracked as an optional task), not a plan blocker.

## 10. Bucket provisioning (added during implementation)

**Decision**: The single pre-configured storage location required by FR-013 is a bucket named via the `MCP_STORAGE_BUCKET` env var (default `mcp-storage`, documented in `.env.example`). `lib/storage/client.ts` checks for the bucket on first use (`HeadBucket`) and creates it automatically (`CreateBucket`) if missing.

**Rationale**: FR-013 requires "a single, pre-configured storage location" but the original plan didn't pin down how that bucket comes to exist — spec 001 deliberately removed automatic default-bucket creation for its own general-purpose buckets, but that decision was about spec 001's own defaults, not about this feature needing a dedicated, working bucket out of the box. Auto-creating this feature's own bucket on first use keeps the MCP server usable immediately after `npm run dev`, with no manual `mc mb` step, consistent with the zero-friction spirit of FR-013.

**Alternatives considered**:
- Requiring the developer to manually create the bucket first — adds a manual step spec 001 explicitly avoided reintroducing (see spec 001's `createbuckets` removal); rejected as unnecessary friction for a bucket this feature owns entirely.
