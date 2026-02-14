# UI Enhancements Epic Plan (UIE)

## Document Purpose
Create a full implementation plan for the UI overhaul on branch `UIE-01-discovery`, grounded in the app's current codebase and focused on an execution-ready roadmap.

## Scope
- Epic: `UI Enhancements (UIE)`
- Branch context: `UIE-01-discovery`
- Mode: discovery and planning only (no production behavior changes required in this document)
- Primary outcome: clear phased plan for moving from current split map/list UI to an origin-first, card-first discovery UX with reusable map surfaces

## Current IDE Context (As Implemented)

### Stack and Runtime
- Vite + React + TypeScript single-page app
- Maps/Places loaded with `@googlemaps/js-api-loader` v2 functional API
- Google Places API (New) used for origin autocomplete element (`gmp-place-autocomplete`)
- Places Search Nearby (`places:searchNearby`) for live candidates
- Optional Routes API enrichment for transit path details

### Core Files and Responsibilities
- `src/App.tsx`: app shell, filter state, origin state, live/mock retrieval, list ranking, list selection, map panel rendering
- `src/components/PlaceAutocomplete.tsx`: Places API (New) web component wrapper and selection handling
- `src/components/MapView.tsx`: map instance, markers, camera behavior, selected-place visibility handling
- `src/services/maps/googleMapsLoader.ts`: singleton loader configuration + `importLibrary` helper
- `src/services/places/googlePlaces.ts`: live nearby search adapter and normalization
- `src/services/transit/googleRoutes.ts`: optional transit-path enrichment
- `src/services/scoring/closishScore.ts`: local ranking logic
- `src/App.css`, `src/index.css`: current UI layout and visual system

### Current UX and Behavior
- Header + two-column layout on desktop:
  - Left panel: origin, filters, list
  - Right panel: persistent map
- Origin model:
  - Default origin: device geolocation when available
  - Override origin: selected place from search
  - Active origin is consistently used for retrieval and ranking
- Results model:
  - Live mode uses Places API when configured
  - Fallback to mock when live unavailable
  - List displays ranked top results and transit/walk summaries
- Map model:
  - Origin marker and selected place marker
  - Camera currently prioritizes origin-centered framing with selected-place visibility guard
  - Map is always visible in the primary page layout

## Problem Statement
The current UI is functionally correct but map-first and panel-heavy. It does not yet support the desired discovery-first flow where users:
- establish origin cleanly,
- browse a modern card grid without immediate map dependence,
- open map context progressively per selected card,
- optionally maximize a focused map view while preserving context.

## Product Goals
- Make origin selection the first-class entry action.
- Keep discovery lightweight and scannable with a card grid.
- Reveal route/map detail progressively only when user shows intent.
- Reuse one map interaction model across embedded and expanded contexts.
- Preserve current algorithm/output behavior while overhauling UX.

## Non-Goals
- No algorithm rewrite in this epic.
- No backend/service architecture changes beyond UI-enabling data plumbing.
- No mandatory persistent account/favorites system in this phase.

## UX Requirements (Target)

### Origin and Entry Flow
- First screen presents welcome + centered origin search + explicit "Use my location" action.
- Do not auto-prompt for geolocation on initial load; request permission only after user intent.
- Search selection always overrides current location until cleared.
- User can switch between "current location" and searched origin at any time.

### Discovery Surface
- After origin is set, show search and filters in a compact sticky row.
- Present places as responsive cards in a modern grid (mobile: 1 column, tablet: 2, desktop: 3+).
- Each card front includes:
  - place name,
  - rating,
  - top-line total trip time (e.g., `28 min`),
  - short metadata chips (walk, transfers, source).

### Card Interaction and Map Reveal
- Selected card becomes active with clear visual highlight.
- Replace 3D flip with accessible expand/reveal behavior:
  - expanded section includes trip breakdown (e.g., `5m walk -> 20m transit -> 3m walk`)
  - embedded map preview centered on origin with destination context
- Optional "maximize map" action opens larger focused map surface for active card.
- Closing/maximizing preserves selected card state in the grid.

## Requirement Coverage Matrix
- Welcome + centered search first: covered by `landing` state and `OriginEntryHero`.
- Graceful geolocation permission handling: covered by explicit CTA-triggered permission flow and denial fallback.
- Search overrides default coordinates: covered by shared origin setter and `originSource` state.
- Default post-origin results without map-first dependency: covered by `results` card-grid state.
- Card summary + travel snapshot: covered by `PlaceCard` front content contract.
- Card detail with transit step breakdown: covered by expandable detail section and `JourneyBreakdown`.
- Card-selected map context: covered by `PlaceMapPreview` anchored to origin.
- Optional larger map experience: covered by `PlaceMapFocusModal` and `mapFocused` state.
- Active card remains highlighted across transitions: covered by `activePlaceId` + `expandedPlaceId` model.

## Best-Practice UX Guidance for This Epic
- Use progressive disclosure: summary first, detail on demand.
- Use explicit permission requests with clear intent messaging.
- Prefer expand/collapse over 3D flip for readability, accessibility, and motion clarity.
- Keep one active card at a time to reduce cognitive load.
- Reuse camera and marker semantics between compact and expanded map surfaces.

## Proposed Information Architecture

### View States
- `landing`: hero + origin actions, no result grid
- `results`: sticky controls + card grid
- `cardExpanded`: results + active expanded card with embedded map
- `mapFocused`: large map surface tied to active card

### Primary State Additions
- `originSource`: `geolocation | search`
- `originStatus`: `unset | ready | permission_denied | loading`
- `viewState`: `landing | results | cardExpanded | mapFocused`
- `activePlaceId`: currently selected place
- `expandedPlaceId`: currently expanded card (single-select)

## Component Architecture Direction
- `OriginEntryHero` (new): welcome + origin search + location CTA
- `TopControlBar` (new): compact search + filters for results state
- `PlaceGrid` (new): card layout and active card orchestration
- `PlaceCard` (new): front summary + expandable detail section
- `JourneyBreakdown` (new): transit step summary renderer
- `PlaceMapPreview` (new): compact map surface for active card
- `PlaceMapFocusModal` (new): large map for detailed inspection
- `MapView` (existing): remain reusable map primitive with camera options

## Implementation Plan (Phased)

### Phase 0: UX Contract and Data Shape Lock
- Finalize card states and transition rules.
- Confirm summary and detail data required for card front/back.
- Freeze minimal state contract (`viewState`, `activePlaceId`, `expandedPlaceId`).

Exit criteria:
- Approved state diagram and component boundaries.

### Phase 1: Shell Refactor (No Behavior Change)
- Split current `App` layout into composable UI containers.
- Extract list rendering into `PlaceGrid` and card primitives.
- Keep existing retrieval/scoring intact behind same props.

Exit criteria:
- UI structure modularized with parity to current behavior.

### Phase 2: Landing + Origin Intent Flow
- Add `landing` state with centered origin entry.
- Move geolocation request behind explicit CTA interaction.
- Route both search and geolocation into shared origin setter.

Exit criteria:
- User can enter via search or location without forced prompt.

### Phase 3: Results Grid Experience
- Replace stacked list with responsive grid cards.
- Add clear active-card highlight and keyboard focus behavior.
- Keep algorithm outputs and ranking logic unchanged.

Exit criteria:
- Responsive card grid is default post-origin view.

### Phase 4: Card Expansion + Embedded Map
- Add expandable card section with transit breakdown.
- Render embedded map preview only for active expanded card.
- Reuse `MapView` camera behavior for origin-centered context.

Exit criteria:
- Active card can expand/collapse and show route-map context.

### Phase 5: Focused Map Surface
- Add maximize action to open large map surface for active card.
- Ensure active card remains highlighted in background context.
- Preserve state on close (no loss of selected/expanded place).

Exit criteria:
- Map focus mode is stable on mobile/desktop.

### Phase 6: Polish, Performance, Accessibility
- Add motion transitions (subtle, optional-reduced-motion aware).
- Add ARIA labels and keyboard interactions for card expansion and modal map.
- Apply map-instance limits/lazy mount for performance.

Exit criteria:
- A11y and performance checklist completed.

## Validation and QA Plan
- Unit-level:
  - origin state transitions
  - view-state reducer/handlers
  - card expansion/selection logic
- Integration-level:
  - origin set/clear/edit flow
  - geolocation denied path
  - search override path
  - active card expansion and map focus entry/exit
- UI regression:
  - desktop and mobile breakpoints
  - no map overlap/clipping with controls
  - active card remains visually consistent across states

## Risks and Mitigations
- Risk: UI rewrite introduces retrieval regressions.
  - Mitigation: isolate data layer and preserve existing fetch/scoring contracts.
- Risk: map-heavy cards degrade performance.
  - Mitigation: mount one embedded map at a time and lazy-load focus map.
- Risk: permission prompt friction reduces conversion.
  - Mitigation: intent-driven geolocation request with search-first fallback.

## Definition of Done (Epic)
- User lands on origin-first screen and can proceed via search or location.
- Results appear as a modern grid with clear summary metrics.
- Active card can reveal route breakdown + embedded map context.
- User can open/close a larger focused map tied to active card.
- Origin override behavior remains consistent with current algorithm flow.
- Mobile and desktop UX pass functional and accessibility checks.

## Immediate Next Discovery Tasks
- Produce low-fidelity wireframes for `landing`, `results`, `cardExpanded`, `mapFocused`.
- Define exact card content hierarchy and truncation behavior.
- Finalize animation and interaction spec for expansion/maximize flows.
- Break the phases above into implementation tickets with point estimates.
