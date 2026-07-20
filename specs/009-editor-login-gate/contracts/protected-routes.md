# Contract: Newly Protected Routes

All routes below require an active owner session (the `oauth_owner_session` cookie, per spec 008). This contract only *adds* an authorization layer in front of each route's existing behavior — request/response shapes for the *authenticated* case are unchanged from spec 003/004/005/007.

## Page route

### `GET /editor`

| Session state | Behavior |
|---|---|
| No active session | `302` redirect to `/oauth/login?continue=%2Feditor` — no editor HTML, file tree, or file content is rendered |
| Active session | Existing editor page renders as today (spec 003–005) |

## API routes

Each handler below gains one guard, checked before any storage access. On failure it returns **before** calling into `lib/storage/*`.

| Route | Methods | Unauthenticated response | Authenticated response |
|---|---|---|---|
| `/api/tree` | GET | `401 { "code": "unauthorized", "message": "Sign in required" }` | Unchanged (spec 003) |
| `/api/directory` | POST, DELETE | same 401 shape | Unchanged (spec 005) |
| `/api/file` | GET, PUT, POST, DELETE | same 401 shape | Unchanged (spec 003–005) |
| `/api/upload` | POST | same 401 shape | Unchanged (spec 004) |
| `/api/download-zip` | GET | same 401 shape | Unchanged (spec 003) |

**Guarantee (FR-004, FR-007)**: in the unauthenticated case, the response body never contains file names, folder names, file content, or any other storage-derived data — only the fixed `unauthorized` error shape above.

## Unaffected routes (explicitly out of scope)

`/mcp`, `/.well-known/oauth-authorization-server`, `/.well-known/oauth-protected-resource`, `/oauth/register`, `/oauth/authorize`, `/oauth/authorize/decision`, `/oauth/token`, `/oauth/revoke`, `/oauth/login`, `/oauth/login/submit`, and `/settings/connected-apps` are all governed by spec 008 already and are not modified by this feature.
