# Closeish Algorithm Research Log

This is the working document for algorithm reasoning and investigation.

Use this document to do two things in one place:
- capture why we are making algorithm decisions,
- keep a point-in-time record of how the algorithm is implemented in the app.

Related docs:
- Retrieval changelog: `docs/PLACES_ALGORITHM_CHANGELOG.md`
- Product roadmap: `docs/MASTER_PLAN.md`
- Option C implementation plan: `docs/TRANSIT_CORRIDOR_ALGORITHM_PLAN.md`

## How To Use This Doc

- Update the snapshot section whenever behavior changes in code.
- Add a reasoning entry for each meaningful discussion or decision.
- Add investigation entries for experiments, even if they fail.
- Keep this doc implementation-focused; keep release storytelling in `docs/RELEASE_NOTES.md`.

## Current Snapshot (Point In Time)

- Date: 2026-02-12
- App version: 1.0.0
- Branch: `feature/algorithm-enhancements`
- Commit: `a41f2fe`
- Scope: Places retrieval + optional Routes transit enrichment + local ranking flow

## Simplified Algorithm (Current)

1. Get user origin from browser geolocation.
2. Decide data mode: if `liveMode` is on and a Places key exists, try live Google Places API; otherwise use mock places.
3. Retrieve candidates by selected category (restaurant/cafe/bar/park).
4. Convert candidates to internal `Place` objects with baseline travel proxies.
5. For live candidates, optionally enrich top-N with Routes transit step data.
6. Filter out places whose walk time is above `maxWalkMinutes + 10`.
7. Score remaining places with `closishScore` (transit-path-aware when enrichment exists).
8. Sort descending by score and keep top `PLACES_TOP_K` (currently 8).
9. Render ranked list and map; map shows user marker plus selected place marker.

## Detailed Implementation (Component/View Interaction)

### 1) App Initialization And Config

- `src/App.tsx` builds config from env.
- Map config uses `VITE_GOOGLE_MAPS_API_KEY` + `VITE_GOOGLE_MAP_ID`.
- Places config uses `VITE_GOOGLE_PLACES_API_KEY` (fallback to maps key).
- Routes config uses `VITE_GOOGLE_ROUTES_API_KEY` (fallback to maps key).
- Map JS loads with `useJsApiLoader` and marker library only (`['marker']`).

### 2) User Inputs That Affect The Algorithm

UI controls live in `src/App.tsx` and update `filters` state.

- `liveMode`: toggles live fetch vs mock fallback behavior.
- `placeType`: changes category and triggers a new retrieval.
- `maxWalkMinutes`: changes local pre-filter threshold and scoring penalty.
- `walkVsTransit`: changes scoring tilt.
- `when` + `timeWindow`: changes scoring tilt only.

Important trigger behavior:
- Retrieval effect reruns on `liveMode`, `placeType`, `position`, Places config, and Routes config changes.
- Scoring/ranking recomputes on any `filters` change or any `places` change.

Control-to-algorithm interaction matrix:

| View Control | State Field | Triggers Retrieval? | Changes Ranking? | Notes |
| --- | --- | --- | --- | --- |
| Live/Plan toggle | `filters.liveMode` | Yes | Yes (`modeTilt`) | Also controls whether live API is attempted. |
| Place type select | `filters.placeType` | Yes | Indirectly (new candidate set) | Mapped to `restaurant/cafe/bar/park`. |
| Max walk slider | `filters.maxWalkMinutes` | No | Yes | Affects pre-filter and walk penalty. |
| Walk vs transit chips | `filters.walkVsTransit` | No | Yes | Controls `preferenceTilt`. |
| When chips | `filters.when` | No | Yes | Controls `whenTilt`; `timeWindow` used when `later`. |
| Time window select | `filters.timeWindow` | No | Yes | Only affects score when `filters.when === 'later'`. |
| Place list click | `selectedPlaceId` | No | No | Updates selection and map focus only. |

### 3) Retrieval Flow In App State

Main retrieval effect is in `src/App.tsx`.

Preconditions:
- No retrieval until `position` is available.
- Live retrieval only when `filters.liveMode && config.isPlacesConfigured`.

Behavior:
- Set `loadingPlaces=true` and clear `placesError`.
- Try live retrieval first when eligible.
- On live success:
- seed top candidates with provisional local score,
- optionally enrich top-N with Routes transit step details,
- set `places`, set source=`live`, preserve selection if ID still exists, then return early.
- On live failure or missing key: set warning message and continue to mock retrieval.
- On mock success: set `places`, set source=`mock`, preserve selection if possible.
- On outer failure: clear places and keep source=`mock`.
- Always set `loadingPlaces=false` in `finally`.

### 4) Live Retrieval Service

Live API implementation is in `src/services/places/googlePlaces.ts`.

- Endpoint: `POST https://places.googleapis.com/v1/places:searchNearby`

Request setup:
- `includedTypes` from selected category.
- `maxResultCount` capped by `PLACES_MAX_RESULTS` (20).
- `rankPreference='POPULARITY'`.
- `locationRestriction.circle` with user origin and `PLACES_RADIUS_METERS` (1500m).

Required headers:
- `X-Goog-Api-Key`.
- `X-Goog-FieldMask=places.id,places.displayName,places.types,places.location,places.rating`.

Response mapping:
- Each provider result is mapped into internal `Place`.
- Travel values are estimated from Haversine distance (not routed travel times).
- Category is inferred from provider `types` and defaults to `restaurant`.

### 4b) Transit Enrichment Service (Option A Bridge)

Transit enrichment implementation is in `src/services/transit/googleRoutes.ts`.

- Endpoint: `POST https://routes.googleapis.com/directions/v2:computeRoutes` (TRANSIT mode).
- Enrichment scope: capped top-N live candidates (`TRANSIT_ENRICH_TOP_N`, currently 6).
- Step parsing extracts:
- total transit minutes,
- access/transfer/egress walk minutes,
- in-vehicle minutes,
- wait minutes,
- transfer count.
- Enriched data is attached to `place.transitPath`.
- If enrichment fails for a place, keep baseline travel proxies for that place.

### 5) Mock Retrieval Service

Mock API is in `src/services/places/mockPlaces.ts`.

- Returns a fixed local dataset.
- Filters only by category.
- `origin` is accepted but currently unused.

### 6) Local Ranking And Pruning

Ranking implementation is in `src/App.tsx` + `src/services/scoring/closishScore.ts`.

Pipeline:
- Pre-filter: keep places where `walkMinutes <= maxWalkMinutes + 10`.
- Score each place with `scorePlace(place, filters)`.
- Sort descending by `closishScore`.
- Slice top K (`PLACES_TOP_K=8`).

Scoring components:
- Baseline path (no `transitPath`): same v1 score formula.
- Enriched path (`transitPath` present):
- `transitBias` uses drive vs enriched total transit.
- `walkPenalty` uses access + transfer + egress walk minutes.
- Adds `transferPenalty`, `waitPenalty`, and `oneSeatBonus`.
- Keeps `desirability`, `preferenceTilt`, `modeTilt`, and `whenTilt`.

Final score:
- Baseline: `closishScore = clamp((transitBias * preferenceTilt * modeTilt * whenTilt) + walkPenalty + desirability, 0, 100)`
- Enriched: `closishScore = clamp(35 + transitEase + walkPenalty + desirability, 0, 100)`

### 7) How Views Reflect Algorithm State

- Ranked list uses `scoredPlaces` (top K only), not the full raw candidate set.
- Header badge shows whether current source is `live` or `mock`.
- Status text communicates loading and fallback/error conditions.
- Clicking a list item sets `selectedPlaceId`.
- `MapView` receives only `position` and `selectedPlace`.
- Map currently renders at most two markers: user position and selected place.
- Map center follows `selectedPlace` when present; otherwise centers on user.
- List metadata shows transfer count when transit enrichment is available for that place.

## Current Constraints (Useful For Investigation)

- Provider ordering starts from popularity, not transit accessibility.
- Transit enrichment is only top-N (not full candidate set).
- No pagination/token chaining for additional candidates.
- Candidate diversity logic is minimal (single category request path).
- No persistence of filters or reasoning results beyond runtime/session docs.

## Reasoning Log

| ID | Date | Topic | Reasoning Summary | Decision | Next Step |
| --- | --- | --- | --- | --- | --- |
| R-001 | 2026-02-12 | Need a shared algorithm reasoning artifact | Current docs separate retrieval changes from implementation detail; hard to track design intent + code behavior together. | Create a combined research log with both simplified snapshot and component-level implementation sections. | Keep snapshot current with each algorithm PR. |
| R-002 | 2026-02-12 | Baseline retrieval strategy for iteration | Current live retrieval is fast and simple but begins with popularity-ranked candidates and heuristic travel proxies. | Treat this implementation as baseline `v1` for future experiment comparison. | Define candidate-quality metrics for next iteration. |
| R-003 | 2026-02-12 | Next-phase direction | Goal is corridor-first discovery where transit ease outweighs straight-line distance. | Move forward with Option C (GTFS-backed graph) and skip origin-stop place search in corridor expansion. | Execute phased plan in `docs/TRANSIT_CORRIDOR_ALGORITHM_PLAN.md`. |
| R-004 | 2026-02-12 | Bridge step before Option C | Need an easy-lift improvement now without blocking corridor-graph architecture later. | Implement Option A top-N Routes transit enrichment + transit-path-aware scoring, with schema designed for future corridor outputs. | Use this as interim baseline while Option C infrastructure is built. |

## Investigation Backlog

| ID | Hypothesis | Proposed Change | Success Signal | Status |
| --- | --- | --- | --- | --- |
| I-001 | Transit-useful places are underrepresented in popularity-first retrieval. | Replace popularity-first retrieval with GTFS corridor traversal + stop-centered place expansion. | Higher share of top results with transit advantage over driving. | Planned (Option C) |
| I-002 | Straight-line travel proxies mis-rank borderline candidates. | Replace distance proxies with path-based transit components (access/egress walk, wait, transfers, in-vehicle). | Better ranking stability when compared with real travel times. | Planned (Option C) |
| I-003 | Single-category retrieval may reduce useful variety. | Evaluate mixed-category or multi-query retrieval under same latency budget. | Higher click/select rate without increased response time beyond budget. | Open |
| I-004 | Top-N transit enrichment can improve ranking quality with limited lift. | Enrich capped top-N candidates via Routes API and compare with v1 rank quality. | Better top-K transit relevance without major latency/cost regression. | Implemented (Option A bridge) |

## Entry Template

Use this for future reasoning and investigation entries.

### Reasoning Entry Template

- ID:
- Date:
- Topic:
- Context:
- Options considered:
- Decision:
- Why:
- Risks:
- Next step:

### Investigation Entry Template

- ID:
- Date:
- Hypothesis:
- Change tested:
- Method:
- Observations:
- Decision:
- Follow-up:
