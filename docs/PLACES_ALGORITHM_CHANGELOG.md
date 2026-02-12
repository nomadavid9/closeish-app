# Places Pull Algorithm Changelog

This document tracks versions of the place-pulling algorithm (data retrieval only), so we can compare behavior over time and keep a clear history of changes.

## Update Rules

- Add a new version entry whenever retrieval behavior changes (query, ranking source, filtering, fallback, limits, or provider).
- Keep older entries unchanged except for typo fixes.
- Include measurable outcomes when available.

## Version Template

Copy this block for each new version:

```md
## vX - Short Title
Date: YYYY-MM-DD
Status: current | archived | experiment

### What Changed
- ...

### Retrieval Strategy
- Provider/API:
- Endpoint:
- Request shape:
- Ranking source:
- Limits:

### Inputs
- ...

### Fallbacks
- ...

### Known Gaps
- ...

### Results / Notes
- ...
```

## v1.1 - Places Nearby + Routes Transit Enrichment (Current)
Date: 2026-02-12
Status: current

### What Changed
- Kept Places API `searchNearby` as primary candidate pull.
- Added optional Routes API enrichment for top live candidates (`TRANSIT_ENRICH_TOP_N`) before final ranking.
- Added transit path metadata support (access/transfer/egress walk, wait, transfers, in-vehicle, total transit).
- Updated scoring to use enriched transit friction signals when present, while preserving v1 fallback behavior.

### Retrieval Strategy
- Provider/API:
- Places API v1 (`searchNearby`) for initial candidate generation.
- Routes API v2 (`computeRoutes`, transit mode) for top-candidate enrichment.
- Endpoint:
- `POST https://places.googleapis.com/v1/places:searchNearby`
- `POST https://routes.googleapis.com/directions/v2:computeRoutes`
- Request shape:
- Places request unchanged from v1.
- Routes requests run for a capped top-N candidate subset and request step-level duration/travel mode fields.
- Ranking source:
- Places popularity order for initial pool.
- Local score reranking with transit-path penalties/bonuses when enrichment succeeds.
- Limits:
- initial candidate cap (`PLACES_MAX_RESULTS`, currently 20)
- enrichment cap (`TRANSIT_ENRICH_TOP_N`, currently 6)
- display cap (`PLACES_TOP_K`, currently 8)

### Inputs
- User geolocation (`lat/lng`).
- Selected place category from filters.
- Env key `VITE_GOOGLE_PLACES_API_KEY` (fallback to `VITE_GOOGLE_MAPS_API_KEY`).
- Optional env key `VITE_GOOGLE_ROUTES_API_KEY` (fallback to `VITE_GOOGLE_MAPS_API_KEY`).

### Fallbacks
- If Routes key is missing or enrichment fails, keep baseline scoring path without breaking live retrieval.
- If Places live fetch fails/non-OK, show warning and use mock dataset.

### Known Gaps
- Still destination-first (not yet corridor traversal from station graph).
- Enrichment runs per candidate and is not yet batched.
- No GTFS graph model or station-level expansion yet (planned in Option C).

### Results / Notes
- Provides an incremental bridge toward corridor-first ranking without replacing existing retrieval architecture.
- Keeps compatibility with Option C by introducing transit-path fields reusable by future corridor graph outputs.

## v1 - Google Places API Nearby Search
Date: 2026-02-12
Status: archived

### What Changed
- Migrated retrieval from legacy Maps JavaScript `PlacesService.nearbySearch` to Places API v1 HTTP `searchNearby`.
- Decoupled map configuration from places configuration (`mapApiKey/mapId` vs `placesApiKey`).
- Kept mock places as fallback when live fetch is unavailable.

### Retrieval Strategy
- Provider/API: Google Places API (New) v1.
- Endpoint: `POST https://places.googleapis.com/v1/places:searchNearby`.
- Request shape:
- `includedTypes`: one of `restaurant | cafe | bar | park` when selected.
- `maxResultCount`: capped at `PLACES_MAX_RESULTS` (currently 20).
- `rankPreference`: `POPULARITY`.
- `locationRestriction.circle`: user origin + radius (`PLACES_RADIUS_METERS`, currently 1500m).
- Field mask: `places.id,places.displayName,places.types,places.location,places.rating`.
- Ranking source: provider popularity from Places API response ordering.
- Limits:
- hard cap on returned candidates (`PLACES_MAX_RESULTS`)
- additional top-K after scoring in app (`PLACES_TOP_K`, currently 8)

### Inputs
- User geolocation (`lat/lng`).
- Selected place category from filters.
- Env key `VITE_GOOGLE_PLACES_API_KEY` (fallback to `VITE_GOOGLE_MAPS_API_KEY`).

### Fallbacks
- If live mode is on but places key is missing, show warning and use mock dataset.
- If API request fails/non-OK, show warning and use mock dataset.

### Known Gaps
- No pagination/token handling beyond initial response.
- Static category mapping only (4 categories).
- No request-time personalization beyond category + radius.
- Travel times are estimated locally from straight-line distance (not routing-aware).

### Results / Notes
- Improved API alignment with Google Places v1 model.
- Reduced dependency on loading the legacy Places JS library for data retrieval.
- Current retrieval still depends on provider popularity + post-fetch app scoring.
