# Feature Specification: Configurable S3-Compatible Storage Connection

**Feature Branch**: `007-s3-storage-config`

**Created**: 2026-07-20

**Status**: Draft

**Input**: User description: "vorrei avere la possibilità di collegare qualsiasi S3 compatible storage, per ora tramite .env, per ora solo uno, in futuro frontend sara caricato su vercel da li si coolega al s3 storage e espne mcp server"

## Clarifications

### Session 2026-07-20

- Q: Should the storage connection support plain HTTP (non-TLS) endpoints, given the local self-hosted MinIO instance from spec 001 typically runs without TLS in development? → A: Allow both HTTP and HTTPS — TLS is enforced only when the operator configures an `https://` endpoint URL; no separate flag is required.
- Q: S3-compatible providers differ on bucket addressing style (path-style vs virtual-hosted-style) — which must the configuration support? → A: Support both, selectable via an explicit configuration setting, so the operator picks the style required by their chosen provider.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Point the system at any S3-compatible storage via configuration (Priority: P1)

As an operator/developer, I want to configure which S3-compatible storage backend the system connects to (the project's local self-hosted storage, a cloud provider's S3-compatible service, or any other S3-API-compatible endpoint) by supplying connection details through environment configuration, so that I can change storage backends without modifying code.

**Why this priority**: This is the core capability of the feature — without externalized, provider-agnostic connection configuration, the system remains hardwired to a single storage location, which is the exact limitation this feature removes.

**Independent Test**: Can be fully tested by supplying a complete set of connection settings (endpoint, credentials, bucket) for a given S3-compatible provider via environment configuration, starting the system, and confirming it performs storage operations against that provider without any code changes.

**Acceptance Scenarios**:

1. **Given** valid connection settings for an S3-compatible provider are supplied via environment configuration, **When** the system starts, **Then** it connects successfully and storage operations (create, read, list, delete) succeed against that provider.
2. **Given** the system is currently configured against one S3-compatible provider, **When** the environment configuration is changed to point to a different S3-compatible provider and the system is restarted, **Then** subsequent storage operations act against the newly configured provider, with no code changes required.
3. **Given** the local self-hosted storage introduced in an earlier feature, **When** its connection details are supplied through the same environment configuration mechanism, **Then** it works as just one valid configuration among other S3-compatible providers, not as a special-cased default.

---

### User Story 2 - Fail fast on misconfiguration (Priority: P2)

As an operator, I want the system to validate the configured storage connection at startup and stop with a clear, actionable error if something is missing or wrong, so that misconfigurations are caught immediately instead of surfacing later as confusing failures during normal use.

**Why this priority**: Once arbitrary providers can be configured, incomplete or incorrect configuration becomes the most likely failure mode; catching it early is essential for a usable operator experience, but the system must first be able to connect (User Story 1) before this validation has anything to check.

**Independent Test**: Can be fully tested by starting the system with missing required settings, then with settings pointing at unreachable or rejecting credentials, and confirming in each case that startup fails with a clear, specific error message rather than starting in a broken state or failing ambiguously later.

**Acceptance Scenarios**:

1. **Given** one or more required connection settings are missing from the environment configuration, **When** the system starts, **Then** startup fails immediately with a clear error message identifying which setting(s) are missing.
2. **Given** all required connection settings are present but the storage endpoint is unreachable or rejects the supplied credentials, **When** the system starts, **Then** startup fails with a clear, actionable error message rather than starting and failing later on the first storage operation.

---

### User Story 3 - Existing storage features keep working regardless of provider (Priority: P3)

As an existing user of the file/directory operations (via the MCP server and the web file explorer), I want those features to behave identically no matter which S3-compatible provider is configured underneath, so that switching providers is transparent to how I already use the system.

**Why this priority**: This is a consistency guarantee rather than new functionality — it confirms the configurability introduced by User Stories 1–2 doesn't leak provider-specific behavior into features that were built assuming a single, fixed storage location.

**Independent Test**: Can be fully tested by running the same sequence of file/directory operations (create, read, update, delete, move, list) once against the local self-hosted storage and once against a different S3-compatible provider, and confirming identical inputs produce identical outputs in both cases.

**Acceptance Scenarios**:

1. **Given** the system is configured against any supported S3-compatible provider, **When** a user performs a file or directory operation through the MCP server or web file explorer, **Then** the operation succeeds with the same behavior as when configured against the local self-hosted storage.

---

### Edge Cases

- What happens when required connection settings are missing at startup? System fails fast with a clear error naming the missing setting(s) (see FR-004).
- What happens when the configured endpoint is unreachable (network/DNS failure) or the configured credentials are rejected? System fails fast at startup with a clear, actionable error rather than starting and failing later (see FR-005).
- What happens when the configured bucket does not exist on the target provider? System MUST surface a clear error identifying the bucket problem rather than a generic or ambiguous failure.
- What happens if an operator changes the environment configuration while the system is already running? The change MUST NOT take effect until the system is restarted; there is no live reconfiguration in this feature.
- What happens if an operator supplies a mix of settings from two different providers by mistake (e.g., one provider's endpoint with another's credential format)? The connectivity/auth check at startup (FR-005) MUST catch this as a connection or authentication failure.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow configuring the connection details for an S3-compatible storage backend — at minimum endpoint URL, access key, secret key, and bucket name, plus region where the provider requires one — through environment configuration (e.g., an `.env` file).
- **FR-002**: System MUST support connecting to any provider that implements the standard S3 API surface (bucket/object operations, standard request signing), not only the project's own local self-hosted storage.
- **FR-003**: System MUST support exactly one active storage configuration at a time; configuring or connecting to multiple storage backends simultaneously is out of scope for this feature.
- **FR-004**: System MUST validate at startup that all required connection settings are present, and MUST fail to start with a clear error message identifying which required setting(s) are missing if any are absent.
- **FR-005**: System MUST verify connectivity and credential validity against the configured storage backend at startup, and MUST fail to start with a clear, actionable error message if the backend is unreachable or the credentials are rejected.
- **FR-006**: System MUST allow switching between different S3-compatible providers using configuration changes alone, with no code changes required.
- **FR-007**: All existing file/directory operations exposed through the MCP server and the web file explorer MUST continue to behave identically regardless of which configured S3-compatible provider is active.
- **FR-008**: System MUST NOT write secret connection values (e.g., the secret access key) to logs in plaintext.
- **FR-009**: System MUST provide a documented example of the required environment configuration (e.g., an `.env.example` file) listing every variable an operator needs to set.
- **FR-010**: Changes to the environment configuration MUST take effect only after the system is restarted; live/hot reloading of the storage configuration at runtime is out of scope for this feature.
- **FR-011**: System MUST support both HTTP and HTTPS endpoint URLs for the configured storage backend, enforcing TLS only when the operator configures an `https://` endpoint; no separate scheme-selection flag is required.
- **FR-012**: System MUST allow the operator to select, via configuration, whether bucket addressing uses path-style (e.g. `endpoint/bucket`) or virtual-hosted-style (e.g. `bucket.endpoint`), so the correct addressing style for the configured provider can be selected explicitly rather than assumed.

### Key Entities

- **Storage Connection Configuration**: The set of values needed to connect to an S3-compatible backend — endpoint URL (HTTP or HTTPS), region (where applicable), access key, secret key, bucket name, and bucket addressing style (path-style or virtual-hosted-style). Exactly one configuration is active at a time; it is supplied via environment configuration and read once at startup.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An operator can switch the system from one S3-compatible storage provider to another by changing only environment configuration values, with zero code changes, and have it fully operational after a single restart.
- **SC-002**: 100% of startup attempts with missing or invalid required connection settings fail immediately with a clear, actionable error message rather than starting in a broken or partially-working state.
- **SC-003**: File and directory operations produce identical results for identical inputs whether the system is configured against the local self-hosted storage or an alternative S3-compatible provider.
- **SC-004**: An operator unfamiliar with the project can identify every required configuration value from the provided documentation/example in under 5 minutes.

## Assumptions

- The local self-hosted storage from the project's earlier storage feature remains a valid, supported target — it becomes one configurable option among others rather than a hardcoded default.
- The MCP server's storage backend, previously assumed to be a single pre-configured location, is the system whose connection this feature externalizes into configuration; this supersedes that earlier assumption of a fixed, hardcoded location.
- "Any S3-compatible storage" means providers implementing the standard S3 API surface; providers requiring non-standard extensions or proprietary auth schemes are out of scope for guaranteed compatibility.
- Supporting multiple simultaneous storage configurations (multi-tenancy) and the future Vercel-hosted frontend's own connection setup to this storage are follow-up work, explicitly out of scope for this feature, which only establishes single-configuration, environment-driven connectivity.
- Credential rotation and integration with external secrets managers are out of scope; plain environment variables are the sole configuration mechanism for this feature.
- The environment configuration mechanism (`.env`) is read by the backend/MCP server process running outside the browser; no storage secrets are ever exposed to or handled by frontend/client code.
