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

## v1 - Google Places API Nearby Search (Current)
Date: 2026-02-12
Status: current

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
