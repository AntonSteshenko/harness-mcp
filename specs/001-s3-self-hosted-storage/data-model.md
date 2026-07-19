# Data Model: Local Self-Hosted S3 Storage

**Input**: [spec.md](./spec.md) Key Entities, [research.md](./research.md)

This feature has no application database — "data model" here means the resources exposed through the S3-compatible API surfaced by the MinIO service, and the local configuration entities that control it.

## Bucket

Represents a named container for objects, provisioned via the S3 API (or auto-created at startup for defaults).

| Field | Type | Notes |
|---|---|---|
| `name` | string | Globally unique within this local instance; must follow S3 bucket-naming rules (lowercase letters, digits, hyphens, dots; 3–63 chars; no leading/trailing hyphen). Invalid names are rejected per FR-006. |
| `created_at` | timestamp | Set by the storage engine when the bucket is created. |
| `is_default` | boolean (derived, not stored) | True for buckets created automatically per FR-013; informational only, not a distinct API-level attribute. |

**Validation rules**: standard S3 bucket-naming constraints, enforced by the MinIO engine itself (FR-006 is satisfied by the engine's native validation — no additional validation layer required).

**Lifecycle**: created → (holds zero or more Objects) → deleted. No intermediate states.

## Object

Represents a stored file/blob within exactly one Bucket.

| Field | Type | Notes |
|---|---|---|
| `key` | string | Path/name unique within its bucket; may contain `/` as a path-like separator per S3 convention. |
| `bucket` | reference → Bucket | The containing bucket. |
| `content` | binary | Opaque to the storage service. |
| `size` | integer (bytes) | Reported by the engine. |
| `content_type` | string | MIME type, either supplied by the client or defaulted. |
| `last_modified` | timestamp | Updated on every write. |

**Validation rules**: standard S3 object-key constraints; malformed keys are rejected per FR-006, enforced natively by the engine.

**Lifecycle**: created/overwritten → read/listed any number of times → deleted. No versioning (out of scope per spec Assumptions).

## Local Access Credential

Represents the fixed identifier/secret pair used to authenticate against the local storage service.

| Field | Type | Notes |
|---|---|---|
| `access_key` | string | Fixed value, committed in `docker-compose.yml` (maps to MinIO's `MINIO_ROOT_USER`). |
| `secret_key` | string | Fixed value, committed in `docker-compose.yml` (maps to MinIO's `MINIO_ROOT_PASSWORD`). |

**Validation rules**: none beyond the storage engine's own minimum length requirements for root credentials. Not a per-user/per-team entity — this feature has a single, shared, local-only credential pair (Assumptions: single-node, non-production).

**Relationships**: a Local Access Credential authorizes operations against all Buckets/Objects in this local instance; there is no per-bucket or per-user access model in scope.
