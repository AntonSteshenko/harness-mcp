# Contract: Tool Management Routes

**Input**: [spec.md](../spec.md), [research.md](../research.md), [data-model.md](../data-model.md)

Extends [specs/024-tools-status-page/contracts/tools-page.md](../../024-tools-status-page/contracts/tools-page.md) (still authoritative for read-only viewing) with the two new routes this feature adds, following the same contract style as [specs/009-editor-login-gate/contracts/protected-routes.md](../../009-editor-login-gate/contracts/protected-routes.md).

## `GET /tools` (updated)

Unchanged authorization behavior from spec 024. Additive:

| Condition | Behavior |
|---|---|
| Active owner session, `?changed=<name>&to=<active\|disabled>` present | Renders the status table as before (spec 024), plus a prominent notice naming `<name>` and its new status, and explicitly warning that already-connected AI assistant sessions may not see the change until they reconnect (spec.md FR-004, FR-005) |
| Active owner session, no `changed` query param | Renders exactly as spec 024 describes, with each row's status control now also offering to change it (link/form to `GET /tools/[name]/confirm`) |

## `GET /tools/[name]/confirm?to=active|disabled`

| Session state | Behavior |
|---|---|
| No active owner session | `302` redirect to `/oauth/login?continue=<this URL>` — no tool information rendered (same guarantee as `/tools` itself) |
| Active owner session, `name` matches a `TOOL_CATALOG` entry, `to` is `active` or `disabled` | Renders a confirmation screen naming `name` and the pending change to `to`, the not-yet-applied warning copy, a form `POST`-ing to `/tools/[name]/status` with `to` as a hidden field, and a cancel link back to `/tools` |
| Active owner session, `name` doesn't match any catalog entry, or `to` is neither `active` nor `disabled` | Rejected with a clear error — no confirmation screen for a nonsensical change (spec.md Edge Cases) |

**Guarantee (FR-003)**: this route has no side effect — reloading it, bookmarking it, or abandoning it without submitting the form leaves the tool's status completely unchanged.

## `POST /tools/[name]/status`

Mirrors `frontend/app/settings/connected-apps/[grantId]/revoke/route.ts`'s shape.

| Condition | Response |
|---|---|
| No active owner session | `401 { "error": "invalid_request", "error_description": "No active owner session" }` — no change applied (spec.md FR-008) |
| Active owner session, `name` doesn't match any `TOOL_CATALOG` entry | Change rejected, no write performed, error reported back to the owner (spec.md FR-010, Edge Cases) |
| Active owner session, `name` valid, underlying storage temporarily unavailable | Change rejected, error reported back to the owner — never a silent "looks successful" response (spec.md FR-010) |
| Active owner session, `name` valid, storage reachable | The Tool Status Record (data-model.md) is updated (name added to or removed from `disabledTools`), then `303` redirect to `/tools?changed=<name>&to=<status>` |

**Guarantee (FR-006, FR-009)**: on success, the change is visible to the very next `/mcp` request (research.md §1) and to the very next `/tools` page load — no restart, no manual refresh trick beyond following the redirect that already happens automatically.

## Unaffected

`GET /tools/[name]/confirm` and `POST /tools/[name]/status` are new; every other route in the app (including `/mcp` itself, whose *behavior* changes per research.md §6 but whose contract — request/response shape, auth requirement — does not) is otherwise unmodified by this feature.
