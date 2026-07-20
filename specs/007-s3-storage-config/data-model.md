# Data Model: Configurable S3-Compatible Storage Connection

**Input**: [spec.md](./spec.md) Key Entities, [research.md](./research.md)

This feature has no application database of its own. Its one entity is a configuration value, not stored data — it is parsed from environment variables once per process lifetime (research.md §2) and held in memory for the life of the server process (FR-010).

## Storage Connection Configuration

Represents the complete set of values needed to connect to a single S3-compatible storage backend (spec.md FR-001–FR-003, FR-011, FR-012).

| Field | Type | Required | Notes |
|---|---|---|---|
| `endpoint` | string (URL) | Yes | Full URL including scheme, e.g. `http://localhost:9000` or `https://s3.example.com`. Scheme determines HTTP vs. HTTPS (research.md §5) — no separate flag. |
| `region` | string | No (defaults to `us-east-1`) | Some S3-compatible providers (e.g. MinIO) accept any value; others require a real region name. |
| `accessKeyId` | string (secret) | Yes | Never logged (FR-008). |
| `secretAccessKey` | string (secret) | Yes | Never logged (FR-008). |
| `bucket` | string | Yes | Must already exist on the target provider (research.md §3) — this feature does not create buckets. |
| `forcePathStyle` | boolean | No (defaults to `true`) | Selects path-style vs. virtual-hosted-style bucket addressing (FR-012, research.md §4). |

**Validation rules**:
- `endpoint`, `accessKeyId`, `secretAccessKey`, and `bucket` MUST all be present and non-empty; if any are missing, loading fails with an error naming every missing field (FR-004).
- `endpoint` MUST parse as a valid URL with an `http:` or `https:` scheme.
- `forcePathStyle`, if set, MUST be the literal string `"true"` or `"false"` (case-insensitive); any other value fails loading with a clear error naming the field.

**Lifecycle**: Loaded exactly once, at process startup, by `frontend/instrumentation.ts`'s `register()` hook (research.md §2). Immutable for the remainder of the process's life — no hot-reload (FR-010). Not persisted anywhere beyond the process's environment variables; the application itself never writes this configuration to disk, a database, or logs (FR-008).

**Connectivity check**: Immediately after loading, a single `HeadBucket` request is issued against `bucket` using the loaded credentials/endpoint. Three distinguishable failure outcomes map to the spec's edge cases:

| Outcome | Meaning | Error surfaced |
|---|---|---|
| Network/DNS failure | `endpoint` unreachable | "storage endpoint unreachable" (FR-005) |
| Auth rejection | `accessKeyId`/`secretAccessKey` invalid | "credentials rejected" (FR-005) |
| Bucket not found | `bucket` does not exist on the provider | "bucket not found" (spec.md Edge Cases, research.md §3) |

## Relationships

- Every existing File/Directory entity from spec 002-s3-mcp-server (see `specs/002-s3-mcp-server/data-model.md`) resolves through exactly one active Storage Connection Configuration — there is no per-request or per-entity choice of backend (FR-003, FR-007).
- The MCP server's and web file explorer's behavior toward Files/Directories is unaffected by which Storage Connection Configuration is active; the configuration only changes *where* the same operations are sent, never *what* they mean (FR-007, SC-003).
