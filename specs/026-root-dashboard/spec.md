# Feature Specification: Root Dashboard Page

**Feature Branch**: `026-root-dashboard`

**Created**: 2026-08-05

**Status**: Draft

**Input**: User description: "default page '/' deve essere un dashboard con links to all existing page"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Land on a dashboard with links to every page (Priority: P1)

A visitor who opens the site's root URL (`/`) sees a dashboard page instead of a blank or missing page, and that dashboard lists a link to every existing top-level page in the product (files, tools, settings sections), so they can get to any part of the product from one starting point.

**Why this priority**: This is the entire feature — without it there is no dashboard and no default landing experience. Everything else is refinement of this core capability.

**Independent Test**: Navigate to `/` in a browser with storage already configured; confirm a dashboard page renders (not a 404) and that it displays a distinct, clickable link for each existing page section.

**Acceptance Scenarios**:

1. **Given** storage is configured and the app is running, **When** a user navigates to `/`, **Then** the dashboard page renders successfully (no 404, no error).
2. **Given** the dashboard is rendered, **When** the user inspects its content, **Then** they see one link per existing top-level page section (Files, Tools, Settings), each labeled clearly enough to identify its destination.
3. **Given** the dashboard is rendered, **When** the user clicks any one of the listed links, **Then** they are taken to that page and it loads normally.

---

### User Story 2 - Dashboard stays accurate as pages are added or removed (Priority: P2)

As the product gains or loses top-level pages over time, the dashboard's link list reflects the current set of pages without requiring a separate, easily-forgotten update step in unrelated feature work.

**Why this priority**: Prevents the dashboard from silently going stale (dead links, or new pages that are never discoverable from the home page), which would undermine the whole point of having a central landing page.

**Independent Test**: Add a new top-level page to the app and confirm the dashboard's link list includes it after the change is deployed, without needing to touch a separate "dashboard registry" file scattered from the page's own code.

**Acceptance Scenarios**:

1. **Given** a new top-level page is added to the product, **When** the dashboard is next viewed, **Then** a link to that new page appears in the dashboard.
2. **Given** a top-level page is removed from the product, **When** the dashboard is next viewed, **Then** the dashboard no longer lists a link to it.

---

### User Story 3 - Dashboard respects existing storage-setup and language behavior (Priority: P3)

A user whose storage is not yet configured is still redirected to the storage setup page instead of seeing the dashboard, and a user with a confirmed language preference sees the dashboard in that language, consistent with how every other page already behaves.

**Why this priority**: Keeps the new page consistent with existing, already-shipped cross-cutting behaviors (storage setup gating, multilingual support) rather than being a special case that breaks user expectations.

**Independent Test**: With storage left unconfigured, navigate to `/` and confirm the existing redirect to the storage setup page still happens instead of showing the dashboard. Separately, with a confirmed language preference set, confirm the dashboard renders its text in that language.

**Acceptance Scenarios**:

1. **Given** storage is not configured, **When** a user navigates to `/`, **Then** they are redirected to the storage setup page, exactly as they would be for any other route today.
2. **Given** a user has a confirmed language preference, **When** they view the dashboard, **Then** its labels and text appear in that language.

---

### Edge Cases

- What happens if a page section has no meaningful "entry point" URL of its own (e.g., an in-flow confirmation step or an OAuth callback route)? These are not standalone destinations a user would navigate to directly, so they are excluded from the dashboard's link list (see Assumptions).
- What happens if the user is not authenticated/authorized for a given linked page? Clicking the link takes them to that page, which enforces its own existing access rules exactly as if the user had typed or bookmarked the URL directly; the dashboard itself does not duplicate that access logic.
- What happens on a very small screen? The dashboard's link list remains readable and every link stays individually tappable (no overlapping targets).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST render a dashboard page at the root path (`/`) when storage is configured, replacing the current no-page/404 behavior at that path.
- **FR-002**: The dashboard MUST display a distinct, clickable link for each existing top-level page section of the product: files, tools, and each settings sub-section (connected apps, personal access tokens).
- **FR-003**: Each link on the dashboard MUST navigate the user to the corresponding page when clicked, and each link's label MUST clearly identify its destination.
- **FR-004**: The dashboard MUST exclude links to routes that are not standalone user destinations (in-flow confirmation steps, OAuth authorize/login callback routes, the storage-setup page itself, and the legacy `/editor` redirect that only forwards to `/files`).
- **FR-005**: The dashboard MUST continue to honor the existing storage-configuration redirect: a user whose storage is not configured is still sent to the storage setup page instead of seeing the dashboard.
- **FR-006**: The dashboard MUST render its text in the user's resolved language, consistent with the rest of the product's multilingual support.
- **FR-007**: The dashboard's link list MUST be derived in a way that keeps it consistent with the actual set of top-level pages, so that adding or removing a top-level page is reflected on the dashboard as part of that same change rather than requiring a separately-tracked update elsewhere.

### Key Entities

- **Dashboard link**: Represents one entry on the dashboard — a display label and the destination page it points to.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user landing on `/` can reach any existing top-level page within a single click, without needing to know or type its URL.
- **SC-002**: 100% of the product's existing top-level pages (files, tools, settings sub-sections) are reachable from the dashboard.
- **SC-003**: Navigating to `/` never results in a 404 or blank page when storage is configured.
- **SC-004**: Existing behaviors unrelated to this feature (storage-setup redirect, language resolution) remain unchanged for every route other than `/`.

## Assumptions

- "All existing page" is interpreted as all existing top-level, user-navigable page sections — files, tools, and the settings sub-sections — not internal flow steps such as the tool-confirmation step or OAuth authorize/login routes, which are not pages a user would choose to land on directly. `/editor` is excluded as a link target because it is a legacy redirect that only forwards to `/files` (spec 018 FR-013), not a distinct destination.
- The storage setup page (`/init`) is deliberately excluded from the dashboard's link list: it is an onboarding/recovery destination reached automatically via redirect when storage is unconfigured, not a page a configured user would navigate to on purpose.
- The dashboard does not introduce any new authentication or authorization gate of its own; each linked page continues to enforce whatever access rules it already has.
- No new visual design system is assumed beyond what the product already uses; the dashboard follows existing UI conventions (consistent with pages like the tools status page) rather than introducing a distinct look.
- The dashboard is a simple, static list/grid of links — no search, filtering, favorites, or usage-based ordering is in scope for this feature.
