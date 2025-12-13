# Closeish Release Notes

## v1.0 — Latency-aware live data with fallback (Phase 4)
- Added Google Places Nearby search path for live data with mock fallback when keys/errors occur.
- Integrated live results into existing ranking, filters, and map/list selection sync; map recenters on selection and shows user + selection markers.
- Capped results/top-K to reduce API fan-out; surfaced loading/error/fallback states and source badges (live vs mock).
- Tests: none yet (manual verification). Env: `VITE_GOOGLE_MAPS_API_KEY`, `VITE_GOOGLE_MAP_ID` required; Places enabled.

## v0.3 — Mock places + scoring stub (Phase 3)
- Added mock Places service and lightweight `closish_score` stub to rank sample destinations without external calls.
- Rendered ranked list/grid with selection syncing to the map; map recenters and marks the selected place alongside the user.
- Filters now influence mock filtering/sorting (place type, walk vs transit, max walk, live/when tilt); loading/empty states included.
- Tests: none yet (manual verification only). Env: `VITE_GOOGLE_MAPS_API_KEY`, `VITE_GOOGLE_MAP_ID`.

## v0.2 — Controlled filters (Phase 2)
- Introduced live/plan toggle, place type select, when/time window chips, walk-vs-transit preference, and max-walk slider with in-memory state.
- Filter summary displayed in the panel; map behavior unchanged. No external API calls.
- Tests: none (manual). Env unchanged.

## v0.1 — Layout shell + env guard (Phase 1)
- Built mobile-first shell with panel + map, Closeish-inspired palette, and centralized `MapView` component.
- Added env/config guard for missing Google Maps vars; map still renders geolocation + marker when configured.
- Tests: none (manual). Env: `VITE_GOOGLE_MAPS_API_KEY`, `VITE_GOOGLE_MAP_ID` required to render map.

## v0.0 — Proof of life
- Basic Vite React app: geolocation, Google Map, and user marker.
- Tests: none (manual). Env: map key + map ID required.
