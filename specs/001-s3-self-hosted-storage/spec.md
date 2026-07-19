# Feature Specification: Local Self-Hosted S3 Storage

**Feature Branch**: `001-s3-self-hosted-storage`

**Created**: 2026-07-19

**Status**: Draft

**Input**: User description: "creare un self hosted storage s3 per avviare localmente, usare docker compose"

## Clarifications

### Session 2026-07-19

- Q: Which underlying software should provide the S3-compatible storage engine? → A: Use the existing open-source MinIO project as the storage engine; do not build a custom S3-compatible implementation from scratch.
- Q: Should the storage service automatically create default buckets on first startup, or leave bucket creation entirely to the developer? → A: Automatically create a small set of default/pre-configured buckets on first startup, so developers have a ready-to-use storage target without manual setup. **(Superseded 2026-07-19: decided not needed — bucket creation is left entirely to the developer; see FR-013 removal below.)**
- Q: How should the local development credentials be provisioned? → A: Fixed default credentials committed directly in the Docker Compose configuration (simplest, zero setup).
- Q: What should happen when the storage service's configured local port is already in use? → A: Startup fails with a clear error message; the developer must free the port or reconfigure it manually.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Start local object storage on demand (Priority: P1)

As a developer, I want to start a self-hosted, S3-compatible object storage service on my local machine with a single command so that I can build and run features that depend on object storage without needing real cloud credentials, cloud costs, or network access.

**Why this priority**: This is the foundation of the feature. Without a working local storage service, no other capability (bucket management, object operations, persistence) can be exercised. It directly replaces the need to depend on a real cloud S3 account during local development.

**Independent Test**: Can be fully tested by running the documented local start command and then connecting to the resulting endpoint with a standard S3-compatible client to confirm the service is reachable and responds to basic requests.

**Acceptance Scenarios**:

1. **Given** the local environment is stopped, **When** the developer runs the documented start command, **Then** the S3-compatible storage service becomes available at a local endpoint within a reasonable startup time.
2. **Given** the storage service is running, **When** the developer runs the documented stop command, **Then** the service shuts down cleanly and the local endpoint is no longer reachable.
3. **Given** the storage service is already running, **When** the developer runs the start command again, **Then** the system does not create a conflicting duplicate instance and the developer receives a clear indication the service is already up.
4. **Given** another process is already using the port the storage service needs, **When** the developer runs the start command, **Then** startup fails with a clear error message rather than starting silently on a different port.

---

### User Story 2 - Manage buckets and objects locally (Priority: P2)

As a developer, I want to create buckets and upload, retrieve, list, and delete objects against the local storage service so that my application code can be developed and tested against realistic object storage behavior.

**Why this priority**: Once the service can be started, the core value comes from actually exercising storage operations that mirror what the application will do against a real S3-compatible service in other environments.

**Independent Test**: Can be fully tested by creating a bucket, uploading a test file, listing bucket contents, downloading the file back, and deleting it, all against the local endpoint, and confirming each step succeeds and returns expected results.

**Acceptance Scenarios**:

1. **Given** the storage service is running, **When** the developer creates a new bucket, **Then** the bucket exists and appears in the list of buckets.
2. **Given** an existing bucket, **When** the developer uploads an object to it, **Then** the object can subsequently be listed and downloaded with identical content.
3. **Given** an object exists in a bucket, **When** the developer deletes it, **Then** it no longer appears in bucket listings or can be downloaded.
4. **Given** a bucket name or object key that violates naming rules, **When** the developer attempts the operation, **Then** the system rejects the request with a clear error instead of silently failing or corrupting data.

---

### User Story 3 - Preserve and reset local data across sessions (Priority: P3)

As a developer, I want data stored in the local storage service to persist across restarts of the service, and I want a simple way to fully wipe that data when I need a clean slate, so that I don't lose test data during normal iteration but can still start fresh when needed.

**Why this priority**: This improves day-to-day developer experience once the core functionality (P1, P2) works, but the feature is still usable without it (data could otherwise be re-created each session).

**Independent Test**: Can be fully tested by storing an object, restarting the storage service, confirming the object is still present, then running the documented reset procedure and confirming all data is gone.

**Acceptance Scenarios**:

1. **Given** an object was stored before the service was restarted, **When** the service comes back up, **Then** the object is still present and retrievable.
2. **Given** the developer wants a clean environment, **When** the developer runs the documented reset procedure, **Then** all previously stored buckets and objects are permanently removed.

---

### Edge Cases

- When the local port the storage service needs is already in use by another process, startup fails with a clear error message; the developer must free the port or reconfigure it manually (see FR-014).
- What happens when the developer's local disk runs out of space while objects are being written?
- How does the system respond to bucket or object operations using invalid, empty, or malformed names?
- What happens if the developer attempts to start the storage service while it is already running?
- What happens if the reset/wipe procedure is run while the service is still running?
- How does the system behave if the developer manually deletes the underlying local data outside of the documented commands?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a self-hosted, S3-compatible object storage service that runs entirely on the developer's local machine, with no dependency on a real cloud provider account, implemented using the existing MinIO open-source project rather than a custom-built storage engine.
- **FR-002**: System MUST allow the storage service to be started and stopped locally using Docker Compose, consistent with how other local services in this project are run.
- **FR-003**: System MUST expose an S3-compatible API endpoint reachable from the local host machine and from other services running in the same local environment.
- **FR-004**: System MUST allow developers to create, list, and delete storage buckets.
- **FR-005**: System MUST allow developers to upload, download, list, and delete objects within a bucket.
- **FR-006**: System MUST reject bucket or object operations that use invalid or malformed names, returning a clear error rather than corrupting data or failing silently.
- **FR-007**: System MUST persist stored buckets and objects across restarts of the storage service until the developer explicitly resets the data.
- **FR-008**: System MUST provide a documented way for developers to fully reset (permanently wipe) all locally stored data on demand.
- **FR-009**: System MUST authenticate storage requests using fixed, locally-scoped credentials that are pre-configured for development use, committed directly in the Docker Compose configuration, and do not depend on any external identity provider.
- **FR-010**: System MUST operate without requiring internet connectivity once the local environment images are available.
- **FR-011**: System MUST keep locally stored data fully isolated from any production or real cloud storage the project may use elsewhere.
- **FR-012**: System MUST provide a way for developers to visually inspect existing buckets and objects (e.g., a browsable interface) to aid debugging during local development.
- **FR-014**: System MUST fail startup with a clear error message if its configured local port is already in use, rather than silently starting on a different port.

> **Removed 2026-07-19**: FR-013 (automatic default bucket creation on first startup) was dropped — decided not needed; bucket creation is left entirely to the developer.

### Key Entities

- **Bucket**: A named container for objects within the local storage service; has a unique name, a creation time, and holds zero or more objects.
- **Object**: A stored file/blob within a bucket; has a key (path/name), binary content, size, content type, and last-modified time.
- **Local Access Credential**: A development-only identifier/secret pair used to authenticate requests against the local storage service; not valid against any production or cloud system.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer with no prior setup can have the local storage service running and ready to accept requests in under 2 minutes using a single documented start command.
- **SC-002**: Developers can successfully perform all core storage operations (create bucket, upload, download, list, delete) against the local service on the first attempt, without needing workarounds.
- **SC-003**: Data stored during a local development session remains available after a routine restart of the storage service in effectively all cases, except when the developer explicitly requests a reset.
- **SC-004**: Developers can fully reset local storage data to a clean state in under 30 seconds using a single documented procedure.
- **SC-005**: The local storage setup requires zero real cloud credentials, cloud accounts, or external network access to function.

## Assumptions

- The project already has, or will define, a Docker Compose configuration where this storage service is added as one of the locally-runnable services.
- The storage service is implemented on top of the existing MinIO open-source project (a pre-built S3-compatible object storage server), not a custom-built storage engine.
- Local development storage only needs to support core bucket/object operations (create, read, list, delete); advanced cloud-specific capabilities such as versioning, replication, lifecycle policies, and fine-grained IAM are out of scope, since the goal is local development parity rather than full production feature parity.
- A single-node, single-instance local storage setup is sufficient; high availability and clustering are out of scope for local development use.
- Access is secured using a fixed, development-only credential set, committed directly in the Docker Compose configuration, suitable solely for local, non-production use; production-grade credential and security management are out of scope for this feature.
- No specific consuming application or service was named in the request, so requirements are written generically as a standalone local storage capability that any part of the project can integrate with.
- Default network ports are chosen to minimize conflicts with other common local development tooling; developers can reconfigure them if a conflict still occurs on their machine.
