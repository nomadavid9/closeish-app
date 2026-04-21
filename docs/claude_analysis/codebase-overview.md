# Closeish — Codebase Overview for Claude

> **Purpose:** This document is written for Claude Code. Read it at the start of any session working on this codebase. It gives you a complete mental model of the project so you don't have to re-derive it from first principles.
>
> **Last updated:** April 2026 (v1 baseline, pre-v2 redesign)

---

## What This App Does

**Closeish** is a reverse transit trip finder. The question it answers is not "how do I get to X?" but "what places near me are surprisingly good by transit?" The user sets an origin (GPS or searched address), picks a place category (restaurants, cafes, parks, bars), and the app surfaces nearby places ranked by how much better they are by transit than by car.

**The v2 redesign** (in progress, see `docs/closeish_v2/02-transit-redesign-proposal.md`) changes the fundamental unit from "a place" to "a complete round-trip plan anchored to a transit line."

---

## Tech Stack

| Layer | Tool | Version |
|---|---|---|
| Build tool | Vite | 5.4.1 |
| UI framework | React (functional components + hooks) | 18.3.1 |
| Language | TypeScript (strict mode) | 5.5.3 |
| Styling | Plain CSS (no CSS-in-JS) | — |
| Maps | @react-google-maps/api | 2.19.3 |
| Maps loader | @googlemaps/js-api-loader | 2.0.2 |

No routing library. No state management library. No backend. All state lives in `App.tsx` via React hooks.

---

## Project Structure

```
src/
  components/
    MapView.tsx          # Google Map with markers
    PlaceAutocomplete.tsx # Wraps Google's <gmp-place-autocomplete> web component
    PlaceCard.tsx        # Result card (v1 — will be replaced in v2)
  config/
    dataSources.ts       # Constants (radius, limits, caps)
  services/
    maps/
      googleMapsLoader.ts    # Singleton loader for Google Maps JS libraries
    places/
      googlePlaces.ts        # Google Places API v1 nearby search
      mockPlaces.ts          # Fallback mock data
    scoring/
      closishScore.ts        # v1 ranking algorithm (0-100)
    transit/
      googleRoutes.ts        # Google Routes API — transit step extraction
  types/
    geo.ts               # Coordinates { lat, lng }
    filters.ts           # FilterState + filterDefaults
    places.ts            # Place, PlaceCategory, TransitPathMetrics, PlaceScore
  App.tsx                # Root component — all state lives here (~637 lines)
  App.css                # All styles (~722 lines, mobile-first)
  main.tsx               # React mount point (5 lines, ignore)
```

---

## Data Flow (v1)

```
User sets origin (GPS or autocomplete)
  → App.tsx useEffect fires
  → googlePlaces.ts: fetchGoogleNearby() — 20 places in radius
  → googleRoutes.ts: enrichPlacesWithTransit() — top 6 only (cost control)
  → closishScore.ts: scorePlace() per place
  → useMemo: sort + slice to top 8
  → PlaceCard components render
  → User selects card → MapView updates
```

---

## Key Patterns to Know

**React hooks = Angular lifecycle + computed properties:**
- `useState` → `BehaviorSubject` or `@Input`
- `useEffect(fn, [])` → `ngOnInit`
- `useEffect(fn, [dep])` → `ngOnChanges`
- `useMemo(fn, [deps])` → Angular `OnPush` / computed getter
- `useRef()` → `@ViewChild`
- Props + callback → `@Input` + `@Output`

**Services are plain functions, not classes.** Import and call directly. No dependency injection.

**`useEffect` cleanup:** Every effect that does async work returns a `() => { active = false }` cleanup function to prevent state updates after unmount. This pattern is used throughout `App.tsx`.

**Two render modes in App.tsx:**
- No origin set → landing page (hero + autocomplete)
- Origin set → main app (filters + map + cards)

---

## State Variables in App.tsx

| Variable | Type | Purpose |
|---|---|---|
| `position` | `Coordinates \| null` | Browser GPS |
| `originOverride` | `{ label, coordinates } \| null` | User-searched address |
| `filters` | `FilterState` | All filter state |
| `places` | `Place[]` | Raw places from API |
| `selectedPlaceId` | `string \| null` | Active card |
| `loadingPlaces` | `boolean` | Loading spinner |
| `placesSource` | `'mock' \| 'live'` | Data provenance |
| `isLoaded` | `boolean` | Google Maps JS ready |

Derived: `const origin = originOverride?.coordinates ?? position`

---

## Environment Variables

```
VITE_GOOGLE_MAPS_API_KEY       # Required — Maps + fallback
VITE_GOOGLE_MAP_ID             # Required — Map styling ID
VITE_GOOGLE_PLACES_API_KEY     # Optional — falls back to Maps key
VITE_GOOGLE_ROUTES_API_KEY     # Optional — falls back to Maps key
```

v2 adds: `VITE_TRANSITLAND_API_KEY`

---

## What Is Changing in v2

See `docs/closeish_v2/02-transit-redesign-proposal.md` for the full proposal and `docs/closeish_v2/03-implementation-plan.md` for the resolved implementation plan.

**Short version:**
- Discovery changes from radius-based to transit-graph-based (following lines outward from origin)
- Adds Transitland as a new data source for stop/line/schedule data
- The unit of recommendation changes from `Place` to `Trip` (full round-trip with feasibility validation)
- Daylight-aware return trip validation
- New types: `Station`, `TransitLine`, `StationVisit`, `Trip`, `TripScore`
- New services: `transitland.ts`, `tripBuilder.ts`, `feasibilityGate.ts`, `tripScore.ts`
- New component: `TripCard.tsx` (replaces `PlaceCard.tsx`)

---

## Files That Will Not Change in v2

- `src/main.tsx`
- `src/components/PlaceAutocomplete.tsx`
- `src/services/maps/googleMapsLoader.ts`
- `src/types/geo.ts`

---

## Developer Notes

- The `PlaceAutocomplete` component uses `useRef` to manually attach a Google custom element (`<gmp-place-autocomplete>`) to the DOM. Do not convert this to declarative JSX — the element is not React-aware.
- `MapView.tsx` uses `useRef` for the map instance (imperative Google Maps API). Camera control is handled via `map.fitBounds()` and `map.panTo()` calls on the ref, not via React state.
- All Google API calls go directly from browser to Google (no backend proxy). CORS is handled by Google.
- Mock data is in `mockPlaces.ts` — used when `filters.liveMode` is false or when live APIs fail.
