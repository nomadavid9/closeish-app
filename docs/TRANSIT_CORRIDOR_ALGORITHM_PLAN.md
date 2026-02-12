# Transit Corridor Algorithm Plan (Option C)

Date: 2026-02-12  
Status: proposed  
Owner: algorithm story (planning scope only)

## 1) Story Goal

Design the next algorithm phase so Closeish can discover places by traversing transit corridors, not by straight-line proximity alone.

This plan focuses on a GTFS-backed graph approach (Option C) that can integrate with the current app structure.

## 2) Decision Summary

Chosen direction: **Option C (GTFS-backed corridor graph)**.

Why:
- Supports corridor traversal in both directions.
- Models stop-to-stop transit structure directly.
- Can score ease-of-trip based on transit experience, not coordinate distance.
- Gives product control over ranking logic and experimentation.

Explicit product rule for this phase:
- **Do not run place searches on the origin station node.**
- Rationale: places around the boarding stop are likely already within local walking discovery and should not consume corridor-search budget.

## 3) Non-Goals (This Story)

- No production rollout yet.
- No full GTFS-realtime integration in phase 1.
- No complete UI redesign.
- No final tuning of all scoring weights.

This story delivers a detailed plan and implementation blueprint only.

## 4) Current vs Target Retrieval

Current (`v1`):
- Pull nearby places around user coordinate.
- Rank with local heuristic scoring.
- Transit accessibility is inferred indirectly.

Target (`v2`):
- Find nearby access stops.
- Traverse transit graph under a generalized cost budget.
- Search places around reachable destination stops (excluding origin stop).
- Rank by transit-friction model + desirability.

## 5) Target System Architecture

### 5.1 Data Layer (GTFS)

Inputs:
- GTFS static feeds per agency (`stops`, `routes`, `trips`, `stop_times`, `calendar`, `calendar_dates`, optional `frequencies`, optional `shapes`).

Persisted artifacts:
- `stops` table: stop ID, name, coordinates, agency.
- `stop_edges` table: directed edge between consecutive stops on trips with in-vehicle time estimate and route metadata.
- `transfer_edges` table: walk-transfer links between nearby stops with walk-time estimate.
- `service_calendar` representation for day/time validity.
- Optional precomputed indexes (spatial + adjacency lists).

### 5.2 Query Layer (Runtime)

Given user origin + filters:
1. Find access stops within user walk threshold (origin access set).
2. Select one or more origin boarding stops (best access candidates).
3. Run bounded graph traversal from selected origin stop(s).
4. Build reachable destination stop set with transit metadata.
5. **Exclude origin stop from destination stop set for place search.**
6. Run place search around reachable destination stops.
7. Deduplicate places and attach best transit path summary.
8. Score and rank.
9. Return top-K for UI.

### 5.3 API Boundary Recommendation

Prefer a thin backend/edge service for this phase.

Why:
- GTFS graph computation should not run in browser.
- Keeps third-party keys and feed management off client.
- Allows caching and latency control.

Suggested endpoint contract (draft):
- `POST /v1/transit-corridor-search`
- Request: user origin, category, max walk minutes, time window, mode preferences.
- Response: ranked places + path summary fields used by scoring and UI.

## 6) Algorithm Specification (v2 Draft)

### 6.1 Step A: Access Stop Detection

- Query nearest stops within `origin_walk_max` (ex: 10-15 min).
- Keep top-N access stops by walk-time + service quality.

### 6.2 Step B: Corridor Traversal

Use a generalized-cost traversal (Dijkstra/A* variant on stop graph):

Generalized cost sketch:
- `C = w_access*walk_to_origin_stop + w_wait*wait_time + w_ivt*in_vehicle_time + w_transfer*transfer_count + w_egress*walk_from_dest_stop`

Constraints:
- Max transfers.
- Max generalized cost.
- Time-window compatibility (now/later).
- Optional service class preference (rail bonus, rapid bus bonus).

Output per destination stop:
- Best path summary: access walk, wait, in-vehicle, transfers, egress walk, total generalized cost.

### 6.3 Step C: Place Candidate Generation By Stop

For each destination stop in ranked traversal order:
- Run nearby places search in radius around stop.
- Radius can vary by station type or line class.

Critical rule:
- **Skip origin stop for place search.**

Additional optional skip rules:
- Skip stops whose area overlaps user local walk radius if we want stricter separation.
- Skip stops with very low service confidence in current time window.

### 6.4 Step D: Candidate Dedup + Attribution

- Deduplicate by place ID.
- If place appears from multiple stops, keep the path with lowest generalized cost.
- Preserve attribution metadata:
- destination stop,
- line/route ID,
- transfer count,
- corridor direction context.

### 6.5 Step E: Ranking

Score shape (initial):
- `score = transit_ease_score + desirability_score - friction_penalties`

Recommended components:
- positive: one-seat ride bonus, high-frequency corridor bonus, place rating/desirability.
- penalties: transfer count, excessive access walk, excessive egress walk, long wait.
- lower penalty weight on in-vehicle rail time than on transfer/walk friction.

Design principle:
- Do not heavily punish long but simple rail trips.
- Strongly punish transfer-heavy and high-walk-friction trips.

## 7) Integration With Current Code Structure

Current flow in `src/App.tsx` can stay mostly intact:
- retrieval call -> `places` state
- scoring -> ranked top-K
- selection -> map/list sync

Planned code-level evolution:
- Add a new retrieval service, e.g. `src/services/places/transitCorridorPlaces.ts` (client to backend endpoint).
- Extend `Place`/related types in `src/types/places.ts` with transit-path metadata.
- Update `scorePlace` in `src/services/scoring/closishScore.ts` to consume transit corridor fields.
- Keep `MapView` API stable initially; optionally add path overlays later.

## 8) Phase Plan (Execution Roadmap)

### Phase 0: Baseline Instrumentation

Deliverables:
- Capture baseline metrics from current `v1` for comparison.
- Define experiment logs and success KPIs.

### Phase 1: GTFS Ingestion Foundation

Deliverables:
- Feed ingestion job(s) and normalized schema.
- Graph build pipeline (stop edges + transfer edges).
- Validation checks for feed freshness and schema quality.

### Phase 2: Traversal Engine

Deliverables:
- Reachable-stop query using generalized cost.
- Runtime filters for time window and transfer caps.
- Unit tests against known corridor examples.

### Phase 3: Stop-Centered Place Expansion

Deliverables:
- Place search around destination stops.
- **Origin stop exclusion implemented and tested.**
- Dedup + path attribution logic.

### Phase 4: Scoring + App Integration

Deliverables:
- New scoring components wired into `closishScore`.
- UI uses enriched transit metadata (initially text-only).
- Fallback behavior preserved.

### Phase 5: Tuning + Guardrails

Deliverables:
- Weight tuning with real corridors.
- Latency and cost guardrails.
- Finalize `v2` rollout criteria.

## 9) Success Criteria

Product-level:
- Results include destinations that are transit-simple even when geographically farther.
- Rail corridor trips with low friction rank competitively.

Technical:
- Origin stop is excluded from place-search node set.
- Deterministic scoring inputs for each returned place.
- p95 response latency within agreed budget for initial rollout.

Quality:
- Corridor test cases pass (including Carlsbad Village -> Solana Beach style scenario).
- No regression in fallback behavior when live sources fail.

## 10) Risks And Mitigations

- GTFS feed variance across agencies:
- Mitigation: feed validation + adapter layer per agency quirks.

- Latency from multi-stop place searches:
- Mitigation: ranked stop budget, caching, and early stopping once candidate target reached.

- Cost growth from API fan-out:
- Mitigation: strict per-request node/search caps and cache-by-stop-time-window.

- Overfitting score weights:
- Mitigation: scenario-based tests and periodic calibration.

## 11) Open Questions

- Which agencies and geographies are in initial launch scope?
- What is the exact per-request node budget for place search fan-out?
- Should bus-only corridors be downweighted relative to rail in phase 1?
- Do we expose transfer count and stop names directly in UI in phase 1?
- What is the rollout gate: offline eval only, or staged shadow mode?

## 12) Story Deliverables Checklist

- [x] Option C selected and justified.
- [x] End-to-end target architecture documented.
- [x] Origin-stop exclusion rule specified.
- [x] Algorithm steps defined from origin to ranking.
- [x] Integration plan mapped to current app structure.
- [x] Phased roadmap with success criteria and risks.
