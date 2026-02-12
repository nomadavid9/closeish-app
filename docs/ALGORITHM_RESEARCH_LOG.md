# Closeish Algorithm Research Log

This is the working document for algorithm reasoning and investigation.

Use this document to do two things in one place:
- capture why we are making algorithm decisions,
- keep a point-in-time record of how the algorithm is implemented in the app.

Related docs:
- Retrieval changelog: `docs/PLACES_ALGORITHM_CHANGELOG.md`
- Product roadmap: `docs/MASTER_PLAN.md`

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
- Scope: current place retrieval + local ranking flow

## Simplified Algorithm (Current)

1. Get user origin from browser geolocation.
2. Decide data mode: if `liveMode` is on and a Places key exists, try live Google Places API; otherwise use mock places.
3. Retrieve candidates by selected category (restaurant/cafe/bar/park).
4. Convert candidates to internal `Place` objects with estimated travel proxies.
5. Filter out places whose walk time is above `maxWalkMinutes + 10`.
6. Score remaining places with `closishScore`.
7. Sort descending by score and keep top `PLACES_TOP_K` (currently 8).
8. Render ranked list and map; map shows user marker plus selected place marker.

## Detailed Implementation (Component/View Interaction)

### 1) App Initialization And Config

- `src/App.tsx` builds config from env.
- Map config uses `VITE_GOOGLE_MAPS_API_KEY` + `VITE_GOOGLE_MAP_ID`.
- Places config uses `VITE_GOOGLE_PLACES_API_KEY` (fallback to maps key).
- Map JS loads with `useJsApiLoader` and marker library only (`['marker']`).

### 2) User Inputs That Affect The Algorithm

UI controls live in `src/App.tsx` and update `filters` state.

- `liveMode`: toggles live fetch vs mock fallback behavior.
- `placeType`: changes category and triggers a new retrieval.
- `maxWalkMinutes`: changes local pre-filter threshold and scoring penalty.
- `walkVsTransit`: changes scoring tilt.
- `when` + `timeWindow`: changes scoring tilt only.

Important trigger behavior:
- Retrieval effect reruns on `liveMode`, `placeType`, `position`, and Places config changes.
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
- On live success: set `places`, set source=`live`, preserve selection if ID still exists, then return early.
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
- `transitBias = clamp((driveMinutes - transitMinutes) * 4, 0, 40)`
- `walkPenalty = clamp((walkMinutes - maxWalkMinutes) * 2, -20, 0)`
- `desirability = clamp(((rating ?? 4) - 3.5) * 10, 0, 20)`
- `preferenceTilt = 1.0 | 0.8 | 0.6` based on `walkVsTransit`
- `modeTilt = 1` for live mode, `0.95` otherwise
- `whenTilt = 1 | 0.98 | 0.96 | 0.94` based on `when/timeWindow`

Final score:
- `closishScore = clamp((transitBias * preferenceTilt * modeTilt * whenTilt) + walkPenalty + desirability, 0, 100)`

### 7) How Views Reflect Algorithm State

- Ranked list uses `scoredPlaces` (top K only), not the full raw candidate set.
- Header badge shows whether current source is `live` or `mock`.
- Status text communicates loading and fallback/error conditions.
- Clicking a list item sets `selectedPlaceId`.
- `MapView` receives only `position` and `selectedPlace`.
- Map currently renders at most two markers: user position and selected place.
- Map center follows `selectedPlace` when present; otherwise centers on user.

## Current Constraints (Useful For Investigation)

- Provider ordering starts from popularity, not transit accessibility.
- Travel times are distance proxies, not route-time API outputs.
- No pagination/token chaining for additional candidates.
- Candidate diversity logic is minimal (single category request path).
- No persistence of filters or reasoning results beyond runtime/session docs.

## Reasoning Log

| ID | Date | Topic | Reasoning Summary | Decision | Next Step |
| --- | --- | --- | --- | --- | --- |
| R-001 | 2026-02-12 | Need a shared algorithm reasoning artifact | Current docs separate retrieval changes from implementation detail; hard to track design intent + code behavior together. | Create a combined research log with both simplified snapshot and component-level implementation sections. | Keep snapshot current with each algorithm PR. |
| R-002 | 2026-02-12 | Baseline retrieval strategy for iteration | Current live retrieval is fast and simple but begins with popularity-ranked candidates and heuristic travel proxies. | Treat this implementation as baseline `v1` for future experiment comparison. | Define candidate-quality metrics for next iteration. |

## Investigation Backlog

| ID | Hypothesis | Proposed Change | Success Signal | Status |
| --- | --- | --- | --- | --- |
| I-001 | Transit-useful places are underrepresented in popularity-first retrieval. | Expand candidate pull and add transit-aware reranking before top-K. | Higher share of top results with transit advantage over driving. | Open |
| I-002 | Straight-line travel proxies mis-rank borderline candidates. | Add route-time enrichment only for top-N candidates. | Better ranking stability when compared with real travel times. | Open |
| I-003 | Single-category retrieval may reduce useful variety. | Evaluate mixed-category or multi-query retrieval under same latency budget. | Higher click/select rate without increased response time beyond budget. | Open |

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
