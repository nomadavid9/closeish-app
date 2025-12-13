# Closeish Master Plan

## Current State
- Vite + React 18 + TypeScript SPA; ESLint + TS build scripts.
- App geolocates the user, loads Google Maps via `@react-google-maps/api`, and shows their position with an Advanced Marker using `VITE_GOOGLE_MAPS_API_KEY` and `VITE_GOOGLE_MAP_ID`.
- Filters are controlled locally: live/plan toggle, place type select, when/time window chips, walk vs transit preference, max walk slider. State is in-memory only.
- Places: live Google Places Nearby search with mock fallback; ranked list/grid synced with map selection; loading/error states present; capped top-K for ranking.
- Styling uses Closeish-inspired palette; no backend; no automated tests yet.

## Guiding Principles
- Ship in small, stable increments; mobile-first UX; keep map usable after every phase.
- Optimize for low latency and few external calls; progressive enhancement and early pruning.
- Prefer mocks/stubs until APIs are chosen; add a thin edge layer only when it clearly adds caching/budgeting value.
- Structure for clarity: `components/`, `services/`, `types/`, `utils/`, `styles/` as needed.
- Working agreements for Codex are documented in `docs/CONTRIBUTING.md` (intent first, `npm version` for bumps, suggested commits/files per change, no manual lockfile edits).

## Phased Roadmap
### Phase 1 (v0.1) — UI shell + structure
Scope: create a mobile-friendly layout shell, add placeholders for filters, centralize map into a component, and add basic env/config warnings. No data or scoring changes.
Done: Layout present with map + panel; env guard surfaced; code organized into components; existing map still works.

### Phase 2 (v0.2) — Filter state (local only)
Scope: add controlled UI for live toggle, place type, when/time window, and walk vs transit preference; persist locally (in-memory) with sensible defaults; no external calls.
Done: Filter UI works and updates state; selections shown in summary; map still stable.

### Phase 3 (v0.3) — Mock places + scoring stub
Scope: introduce a mock Places service returning sample destinations; add a lightweight `closish_score` stub (bucketed transit vs drive vs walk proxies); display a ranked list/grid and reflect selection on the map; keep API-free.
Done: Mock data rendered and ranked; selection highlights on map/list; scoring pseudocode documented.

### Phase 4 (v1.0) — Latency-aware discovery (minimal real data)
Scope: plug in a minimal external source (e.g., Places API or curated JSON) with a two-phase retrieval and top-K pruning; compute `closish_score` from cheap heuristics first, then enrich only top candidates; add simple loading/error states.
Done: Real data path works with fallback mocks; latency guards in place; top-K pruning exercised; map/list synchronized.

### Phase 5 (v2.0) — Edge caching + call budgeting
Scope: add a thin edge/back-end layer for caching, rate limiting, and call budgeting; introduce config for API quotas; add smoke tests for the edge endpoint; keep frontend behavior unchanged.
Done: Edge endpoint deployed/configured; cache and quota controls documented; frontend uses cached path by default with fallback.

### Phase 6 (v3.0) — Transit intelligence
Scope: add station-aware retrieval/pruning and better travel-time estimation; refine `closish_score` with diminishing returns for distance and desirability; run expensive comparisons only for top-K.
Done: Station-aware heuristics present; scoring incorporates transit vs drive vs walk deltas; performance budget documented.

### Phase 7 (vNext) — Accounts + favorites
Scope: optional login, favorites, and saved filters; only if needed; reuse edge layer for persistence.
Done: Auth flow + favorites stored; no regression to latency budgets.

## Architectural Notes (evolving)
- Components: map, panels, list items, filter controls; keep props typed and presentational when possible.
- Services: `places` (mock → real), `scoring`, `geolocation`, `storage` (local), later `edge-client` for cached calls.
- Types: coordinates, place, score breakdown, filters, app config.
- Utilities: formatting, time windows, feature flags.
- Testing: start with lightweight component tests once stateful UI appears; add contract tests when the edge layer exists.
- Environment & Secrets: use `VITE_*` for frontend-exposed values; keep keys out of git; `.env.local` for dev, host-level env or `.env.production` for prod; include `.env.example` with placeholders; geolocation requires HTTPS in prod; keep the map config guard; plan an edge proxy in later phases to hide third-party secrets and add caching/quota controls; gate experiments with `VITE_FEATURE_*` flags.

## Release Log
- See `docs/RELEASE_NOTES.md` for per-version details.
- v0.0 — Proof-of-life: geolocation + Google Map + marker.
- v0.1 — Phase 1 shell: layout, placeholders, env guard, map componentized.
- v0.2 — Phase 2 filters: controlled filter UI with local state (live/plan, place type, when/time window, walk vs transit, max walk).
- v0.3 — Phase 3 mocks: mock places + scoring stub + ranked list.
- v1.0 — Phase 4 latency-aware discovery with minimal real data + top-K pruning + mock fallback.
- v2.0 — Phase 5 edge caching + call budgeting.
- v3.0 — Phase 6 transit intelligence (station-aware heuristics).
- vNext — Optional accounts + favorites.
