# Feature Specification: Live File Sync in the Files Interface

**Feature Branch**: `019-live-file-sync`

**Created**: 2026-07-29

**Status**: Draft

**Input**: User description: "quando agente cambia i file non si vede in interfaccia files, devo aggiornare manualmente la pagina, forse dobbiamo implementare rinnovo automatico periodico, ma anche tenere interfaccia fluida, non aggiornare tutta la pagina ma solo quello che è cambiato. Sarebbe bello anche avere una cache, cosi interfaccia diventera piu veloce, tutti aggiornamenti fare in background." (When an agent changes files, it's not reflected in the files interface — I have to manually refresh the page. We probably need periodic automatic refresh, but keep the interface fluid: don't reload the whole page, only what changed. It would also be nice to have a cache so the interface becomes faster, with all updates happening in the background.)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See externally-added or externally-changed files without reloading (Priority: P1)

A user has the files interface open with one or more folders expanded. Meanwhile, an MCP agent (or another browser tab/session) creates, edits, or deletes files in the storage. Without the user doing anything, the expanded folders in the tree update in the background to reflect the new state — new files appear, deleted files disappear, changed files show updated metadata — without a full-page reload and without disrupting whatever the user is currently doing (scrolled position, open menus, expanded/collapsed state of other folders).

**Why this priority**: This is the core complaint — today the tree is a one-time snapshot per folder, so any external change is invisible until the user manually forces a reload. This is the minimum change that delivers value.

**Independent Test**: Can be fully tested by expanding a folder in the UI, then creating/deleting a file in that folder through another channel (e.g. the MCP tools or another browser tab), and confirming the change appears in the tree within the refresh window without a page reload.

**Acceptance Scenarios**:

1. **Given** a folder is expanded and showing its current contents, **When** a new file is added to that folder from outside the browser tab, **Then** the new file appears in the tree within the background refresh window, without the page reloading and without collapsing any other expanded folder.
2. **Given** a folder is expanded, **When** a file inside it is deleted from outside the browser tab, **Then** the file disappears from the tree within the background refresh window.
3. **Given** the browser tab is in the background (not the active tab), **When** external changes happen, **Then** the interface does not keep polling while hidden, and catches up automatically once the tab becomes active again.

---

### User Story 2 - Safely notice when the open file changed elsewhere, without losing unsaved edits (Priority: P1)

A user has a file open in the editor. Elsewhere, that same file is changed (by an agent or another session). If the user has no unsaved edits, the editor content quietly updates to match the new version. If the user *does* have unsaved edits, their edits are never silently overwritten — instead they see a clear, non-blocking notice that the file changed externally, with an explicit choice: reload the external version (discarding their edits) or keep working on their own version.

**Why this priority**: This is the highest-risk part of "auto refresh" — done carelessly, it can destroy a user's in-progress work. It must ship alongside User Story 1, not after it, since background sync makes this scenario reachable the moment periodic refresh exists.

**Independent Test**: Can be fully tested by opening a file, making an edit without saving, then changing the same file from another channel, and confirming the editor shows a non-blocking conflict notice rather than replacing the text box content.

**Acceptance Scenarios**:

1. **Given** a file is open with no unsaved edits, **When** the file is changed externally, **Then** the displayed content updates automatically to the new version, with no user action required and no interruption (e.g. no modal, no loss of scroll position or view mode).
2. **Given** a file is open with unsaved edits, **When** the file is changed externally, **Then** the user's edits remain untouched in the editor and a non-blocking notice appears explaining that the file changed externally, offering the choice to reload the external version or keep their own.
3. **Given** the conflict notice is showing, **When** the user chooses to reload the external version, **Then** the editor replaces their content with the latest saved version and the notice disappears.
4. **Given** the conflict notice is showing, **When** the user chooses to keep their own version, **Then** the notice disappears, their edits remain, and saving proceeds normally (overwriting the external change) if they later click Save.

---

### User Story 3 - Snappier navigation via cached data (Priority: P3)

When the user re-opens a folder they already browsed, or returns to a file they already viewed, the previously-fetched data is shown immediately instead of a fresh loading state, while an up-to-date version is fetched in the background and applied if anything changed.

**Why this priority**: This is a perceived-performance improvement, not a correctness fix — it's valuable but the interface works correctly without it, unlike Stories 1 and 2.

**Independent Test**: Can be fully tested by expanding a folder, collapsing it, then re-expanding it, and confirming the previously-loaded listing appears with no visible loading state, with any changes since the last fetch applied moments later.

**Acceptance Scenarios**:

1. **Given** a folder was previously expanded and its contents loaded, **When** the user collapses and re-expands it, **Then** the last-known listing is shown immediately, not a loading indicator.
2. **Given** cached data is shown immediately, **When** a background revalidation completes and finds no changes, **Then** nothing visibly changes (no flicker, no re-render of unaffected rows).

### Edge Cases

- What happens if the currently-open file is deleted externally while the user has unsaved edits? The user gets a non-blocking notice that the file was removed, and can choose to keep their content (and re-save it, which recreates the file) or discard it.
- What happens if the currently open folder is deleted externally? The tree collapses/removes that node the same way it does today after an in-app delete, and if a file open in the editor was inside it, the same removed-file handling from the edge case above applies.
- What happens if background refresh requests fail (e.g. transient network error)? The interface keeps showing the last-known-good data and quietly retries on the next cycle, without surfacing an error for a single missed refresh.
- What happens when many folders are expanded at once? Each expanded folder refreshes independently; refresh does not compound into full-tree reloads.
- What happens if the user is actively renaming/creating/deleting something (an in-flight action) when a background refresh lands? The in-flight action's own explicit refresh takes precedence; a background refresh must not clobber an action that's already in progress.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST periodically re-check the contents of any expanded folder in the files tree and reflect additions, deletions, and metadata changes without requiring a manual page reload.
- **FR-002**: The system MUST periodically re-check whether the file currently open in the editor has changed externally, without requiring a manual page reload.
- **FR-003**: Background refresh MUST update only the parts of the interface that changed — existing scroll position, expand/collapse state, open menus, and unaffected rows/files MUST remain undisturbed.
- **FR-004**: When the currently open file has no unsaved edits and has changed externally, the system MUST refresh its displayed content automatically without user confirmation.
- **FR-005**: When the currently open file has unsaved edits and has changed externally, the system MUST NOT overwrite the user's edits automatically; it MUST present a non-blocking notice with an explicit choice to reload the external version or keep the user's own version.
- **FR-006**: The system MUST pause background refresh while the browser tab is not visible/active, and resume it (catching up immediately) when the tab becomes active again.
- **FR-007**: The system MUST show previously-fetched folder/file data immediately when re-visited, while refreshing it in the background, rather than showing a loading state for data already seen in this session.
- **FR-008**: A failed background refresh attempt MUST NOT replace currently-displayed data with an error state; the last-known-good data remains visible and the system retries on the next cycle.
- **FR-009**: An explicit, user-triggered refresh (e.g. after the user's own create/upload/delete action) MUST continue to take priority over and not be blocked by a pending background refresh cycle.
- **FR-010**: Background refresh MUST NOT re-fetch the full content of the currently open file merely to check whether it changed; only enough information to detect a change (e.g. modification time) is needed until a change is actually detected.

### Key Entities

- **Folder listing snapshot**: The set of files and subfolders known for one expanded folder at a point in time, including each entry's modification time — refreshed periodically and diffed against its previous snapshot to detect additions/removals/changes.
- **Open file sync state**: Whether the file currently open in the editor is known to be in sync with, ahead of (unsaved local edits), or diverged from (changed both locally and externally) the stored version.
- **External change notice**: The non-blocking, dismissible conflict prompt shown when the open file diverged, carrying the two possible resolutions (reload external / keep local).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A file added, changed, or deleted outside the browser tab becomes visible in an expanded folder within 30 seconds, with no manual page reload.
- **SC-002**: Zero cases of a user's unsaved edits being silently overwritten by a background refresh.
- **SC-003**: Re-visiting a previously-loaded folder or file shows existing data instantly (no loading indicator) in at least 95% of cases within the same session.
- **SC-004**: Background refresh activity while the browser tab is inactive/hidden generates no additional requests until the tab becomes active again.
- **SC-005**: A single failed background refresh cycle produces no visible error state to the user.

## Assumptions

- "External changes" primarily means changes made through the MCP tools (the agent) or another browser tab/session — not a live multi-region storage replication scenario.
- A refresh window on the order of tens of seconds (not sub-second) is an acceptable trade-off between freshness and load on the storage backend; exact timing is a planning-phase decision, not a scope decision.
- True real-time push (e.g. storage-level change notifications delivered instantly to the browser) is out of scope for this feature; periodic background re-checking is sufficient to meet the stated need.
- The existing manual "refresh after my own action" behavior (e.g. after upload/create/delete) is preserved as-is and is not replaced by the new background mechanism.
- Users are expected to occasionally have the same file open in more than one tab/session; this spec only guarantees the open-editor conflict notice described in User Story 2, not real-time collaborative editing (e.g. no live cursor sharing or operational transforms).
