# Quickstart: REST API Token Authentication

Validates the acceptance scenarios in [spec.md](./spec.md) end-to-end against a running dev server. No automated test suite exists in this repo (see plan.md Technical Context); this is the manual validation path.

## Prerequisites

- `frontend/` dependencies installed (`npm install` inside `frontend/`, if not already done)
- Storage env vars set (`S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`) so `middleware.ts` does not redirect every request to `/init`
- An owner session available in the browser (sign in via `/oauth/login`) to create a Personal Access Token and to validate User Story 3
- `curl` (or any HTTP client capable of setting a custom header) to exercise the API without a browser session

## Run

```bash
cd frontend
npm run dev
```

## Validate — User Story 1 (read a file with a PAT, no session cookie)

1. Signed in as owner in the browser, go to `/settings/personal-access-tokens`, create a token, and copy the secret value shown (it is shown once — see spec 013).
2. Upload or create some file through the existing editor (e.g., `/files`) so there is a known `path` to read back, e.g. `test.csv`.
3. From a terminal — **no cookies, no browser** — run:
   ```bash
   curl -i "http://localhost:3000/api/file?path=test.csv" \
     -H "Authorization: Bearer <paste-the-PAT-secret-here>"
   ```
   - **Expect**: `200`, response body contains the file's content (SC-001, contracts/file-api-auth.md).
4. Repeat the same request but replace the token with an existing, still-valid OAuth access token (obtained via the existing spec 008 authorization-code flow, e.g. through a connected client) instead of a PAT.
   - **Expect**: `200`, same result — confirms both credential types work (Acceptance Scenario 2).

## Validate — User Story 2 (write a file with a PAT, no session cookie)

5. Still with no cookies, submit an update:
   ```bash
   curl -i -X PUT "http://localhost:3000/api/file?path=test.csv" \
     -H "Authorization: Bearer <paste-the-PAT-secret-here>" \
     -H "Content-Type: application/json" \
     -d '{"content":"a,b,c\n1,2,3\n"}'
   ```
   - **Expect**: `200`/success response; reloading the file in the browser editor shows the updated content (SC-002).
6. In the browser, go back to `/settings/personal-access-tokens` and revoke the token used above. Repeat the same `curl` request from step 5 with the now-revoked token.
   - **Expect**: `401` `{ "code": "unauthorized", "message": "Sign in required" }`, and the file content is unchanged from step 5 (Acceptance Scenario 2 of User Story 2, SC-004).

## Validate — User Story 3 (existing browser session behavior is unchanged)

7. In the browser, with a normal signed-in session and dev tools open to the Network tab, use the file editor at `/files` to open, edit, and save a file.
   - **Expect**: works exactly as before this feature — no new prompts, no change in requests/responses (FR-003).
8. In the same browser session, inspect the request the editor sent to `/api/file` — confirm it carries the `oauth_owner_session` cookie and **no** `Authorization` header, and still succeeds (confirms the cookie path is untouched).

## Validate — Edge cases

9. From a terminal with no cookies and no `Authorization` header at all:
   ```bash
   curl -i "http://localhost:3000/api/file?path=test.csv"
   ```
   - **Expect**: `401`, same shape as today (unchanged baseline behavior).
10. From a terminal with a syntactically invalid bearer value:
    ```bash
    curl -i "http://localhost:3000/api/file?path=test.csv" -H "Authorization: Bearer not-a-real-token"
    ```
    - **Expect**: `401`, same shape (SC-004).

## Pass criteria

All ten steps above match their **Expect** outcome. If any step diverges, the corresponding functional requirement in spec.md has a regression.
