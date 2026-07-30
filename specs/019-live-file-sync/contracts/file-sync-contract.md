# Contract: File Sync Additions to `/api/file`

This documents only the **additive** changes to the existing `/api/file` contract (spec 003/018). All existing behavior of `GET`, `PUT`, `POST`, `DELETE` is unchanged except the one noted field addition.

## `GET /api/file?path={path}` — response body gains `etag`

Existing success response (200):

```json
{
  "path": "notes/todo.md",
  "content": "...",
  "size": 1234,
  "lastModified": "2026-07-29T10:15:00.000Z"
}
```

**New field**: `"etag": "\"9e107d9d372bb6826bd81d3542a419d6\""` (S3's `ETag`, including its surrounding quotes as returned by the AWS SDK — treat it as an opaque string, do not strip or reformat it).

Error responses (404 `not_found`/`type_mismatch`, 422 `unsupported`, 502 `storage_unreachable`) are unchanged.

## `HEAD /api/file?path={path}` — new endpoint

**Purpose**: cheap check of whether the file at `path` has changed, without transferring its content.

**Auth**: same `requireOwnerSession()` gate as every other verb on this route.

**Request**: `HEAD /api/file?path=notes/todo.md`

**Success response**: `200 OK`, empty body, headers:
- `ETag`: same opaque string as the `GET` response's `etag` field — this is the field the client compares against `EditorSession.loadedEtag`.
- `Last-Modified`: HTTP-date formatted, informational only (not used for the change-detection comparison — see research.md §3).

**Error responses**: same status codes as `GET` (`404` for `not_found`/`type_mismatch`, `502` for `storage_unreachable`), empty body — a `HEAD` response never carries a JSON body, so error *codes* are conveyed by status only. Callers that need the error *message* text should fall back to `GET` (which they already call for the initial full load).

**Not provided**: `?path` missing → `404` (same as `GET`'s `not_found` behavior for a missing path), empty body.

## Client consumption pattern

Two independent SWR keys per open file:

| SWR key | Verb | Refresh | Purpose |
|---|---|---|---|
| `` `/api/file?path=${path}` `` | `GET` | On mount; on explicit `mutate()` only (not on the interval) | Full content — loaded once, then only re-fetched when the metadata key signals a real change, or the user picks "reload external version" |
| `` `['file-etag', path]` `` (custom key; fetcher issues `HEAD`) | `HEAD` | Every `refreshInterval` (15s) while path is set and tab visible | Cheap change signal — its `onSuccess`/effect compares the returned `ETag` to `EditorSession.loadedEtag` and drives the state transitions in data-model.md |

The tree listing continues to use a single SWR key per expanded directory (`` `/api/tree?path=${path}` ``, unchanged contract) — no `HEAD` variant is needed there since `GET /api/tree` already returns per-entry `lastModified` cheaply for an entire directory in one call, and directories are typically small enough that re-fetching the full listing on each poll is itself cheap.
