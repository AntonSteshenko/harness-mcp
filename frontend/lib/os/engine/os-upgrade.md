---
type: engine
resource: os-upgrade
---

# Os-upgrade — checking for and applying an engine upgrade

Use this when the owner explicitly asks something like "check for an OS
upgrade", "is my Company OS up to date", or "upgrade the OS". It never
self-triggers — unlike the `init` resource's business-data check, this only
runs when asked.

## Procedure

1. `read_file "AGENTS.md"`. Read its `os-engine-version` front matter field
   (absent → version `0`).
2. Read the `engine` resource. Read its current `os-engine-version` and its
   `## Changelog` section.
3. Compare:
   - **Recorded version already matches current** → tell the owner, in
     `os/language` (read that file; English if it doesn't exist), that there's
     nothing new. Change nothing in the bucket.
   - **Recorded version is behind current** → this is exactly the situation
     the `engine` resource's own **Repair** procedure already handles (collect
     every skipped `### vN` changelog entry, present their union as one
     summarized description in `os/language`, ask for confirmation). Follow
     that same procedure here rather than re-describing it — repair and an
     explicit upgrade check share one confirm-before-change gate, never two
     independent ones.
   - **No `os-engine-version` recorded at all (v0)** → also defer to the
     `engine` resource, which handles the v0 case (routing-table extraction
     into `os/routing.md` before rebuilding) as part of the same procedure.
4. Only rebuild `AGENTS.md` after the owner confirms. If declined, leave
   everything untouched and be ready to offer the same check again whenever
   asked.
