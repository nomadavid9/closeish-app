# Closeish v2 — Implementation Plan

> **Purpose:** Concrete implementation plan for the transit redesign described in `02-transit-redesign-proposal.md`. This document resolves all open design questions, defines every new type and service, and lays out a phased build sequence. It is the handoff document for execution.
>
> **Companion documents:** `01-current-architecture.md` (baseline), `02-transit-redesign-proposal.md` (proposal).

---

## 0. Before You Start: New API Requirement

The redesign requires **Transitland** in addition to the existing Google APIs.

| Key | Where | Notes |
|---|---|---|
| `VITE_TRANSITLAND_API_KEY` | `.env.local` | Free tier: 10,000 REST calls/month. Register at transit.land. Requires attribution. Non-commercial use. |
| `VITE_GOOGLE_MAPS_API_KEY` | `.env.local` | Unchanged |
| `VITE_GOOGLE_MAP_ID` | `.env.local` | Unchanged |
| `VITE_GOOGLE_PLACES_API_KEY` | `.env.local` | Unchanged (optional, falls back to Maps key) |
| `VITE_GOOGLE_ROUTES_API_KEY` | `.env.local` | Unchanged (optional, used for walking legs only in v2) |

Attribution requirement: the Transitland free tier requires a visible link to `transit.land` somewhere in the app UI.

---

## 1. Resolved Design Questions

These correspond directly to the open questions in §5 of the proposal. Decisions are final for this implementation pass.

### 1.1 Station Traversal Bounding

**Decision: Ride-time cap per mode (primary), with overlap detection (cost optimization).**

The ride-time cap is the hard outer bound. At each station during traversal, estimate cumulative ride time from the origin station. If it exceeds the cap, stop traversal in that direction on that line.

**Mode caps:**

| `route_type` (GTFS) | Mode | Ride-time cap |
|---|---|---|
| 2 | Commuter rail | 60 min |
| 1 | Subway / metro | 40 min |
| 0 | Light rail / tram | 35 min |
| 3 | Bus (standard) | 25 min |
| 5 | Cable car / streetcar | 20 min |
| 4 | Ferry | 45 min |

**Overlap detection (API cost guard):** When about to issue a Places call for station N, check whether the station N-1 Places halo (800 m radius) overlaps the station N halo by more than 60% (using the Haversine distance between stations vs. combined halo radii). If yes, skip the Places call — the neighborhood is already covered.

**Rationale for rejecting pure radius cap:** A commuter rail station 18 miles away but 35 minutes away is more "close-ish" than a bus stop 4 miles away but 40 minutes away. Radius caps would systematically exclude the trips the app exists to surface.

### 1.2 Data Structures for Lines, Stations, and Directions

**Decision: `TransitLine` (ordered station array per direction) as traversal input; `StationVisit` (flat list) as traversal output.**

We do not use a graph. Single-leg-only means we never need to cross lines, so graph traversal complexity is wasted. The ordered array per direction maps directly to what Transitland returns (a trip's `stop_times` array, sorted by `stop_sequence`).

See §3 for full type definitions.

### 1.3 Mode Tolerance — Internal or User-Exposed

**Decision: Internal defaults for this pass. Not exposed to user.**

The mode caps in §1.1 are invisible to the user. The user controls mode preference (`all` / `train` / `bus`) which filters which lines are traversed at all — separate from the per-mode time cap. The cap can be promoted to a user control in a later iteration if user research shows demand.

### 1.4 The Trip Type

**Decision: `Trip` is the primary data unit everywhere in v2 — scorer, card, map, feasibility gate all speak `Trip`.**

Full definition in §3.4 below.

### 1.5 Role of Existing Services

| Service | v2 fate |
|---|---|
| `googlePlaces.ts` | **Survives, called differently.** Called per candidate station instead of once per origin. Signature stays the same. |
| `googleRoutes.ts` | **Narrowed.** No longer used for transit validation (Transitland handles that). Kept for walking leg estimation (origin → station, station → place). Can be replaced with Haversine if Routes API costs are a concern. |
| `closishScore.ts` | **Absorbed.** Scoring concepts carry over into the new `tripScore.ts`, but `closishScore.ts` is deleted when v1 is fully replaced. |
| `googleMapsLoader.ts` | **Unchanged.** |
| `mockPlaces.ts` | **Extended.** Add mock `Trip[]` data alongside existing mock places for offline development. |

---

## 2. What Changes vs. What Survives

### Survives Unchanged
- `src/main.tsx`
- `src/components/PlaceAutocomplete.tsx`
- `src/components/MapView.tsx` (minor additions — see Phase 5)
- `src/services/maps/googleMapsLoader.ts`
- `src/types/geo.ts`
- `src/config/dataSources.ts` (new constants added, none removed)

### Modified
- `src/App.tsx` — state shape changes significantly; orchestration logic replaced
- `src/App.css` — new card layout, new filter controls, eliminated-trip styling
- `src/types/filters.ts` — four new filter fields
- `src/types/places.ts` — `Place` survives as a dependency of `Trip`; some fields become optional
- `src/services/places/googlePlaces.ts` — signature stays, call site moves
- `src/services/transit/googleRoutes.ts` — narrowed to walking legs only
- `src/services/places/mockPlaces.ts` — add mock trips

### New Files
- `src/types/transit.ts`
- `src/types/trip.ts`
- `src/services/transit/transitland.ts`
- `src/services/trips/tripBuilder.ts`
- `src/services/trips/feasibilityGate.ts`
- `src/services/scoring/tripScore.ts`
- `src/components/TripCard.tsx`

### Deleted (when v2 is complete)
- `src/services/scoring/closishScore.ts`
- `src/components/PlaceCard.tsx`

---

## 3. New Type Definitions

All new types live in `src/types/`. Add in this order (each depends on the previous).

### 3.1 `src/types/transit.ts` (new file)

```typescript
// GTFS route_type values we care about
export type TransitMode =
  | 'commuter_rail'  // route_type 2
  | 'subway'         // route_type 1
  | 'light_rail'     // route_type 0
  | 'bus'            // route_type 3
  | 'ferry'          // route_type 4
  | 'cable_car'      // route_type 5

export type DirectionId = 0 | 1

export interface Station {
  id: string                  // Transitland onestop_id (stable)
  name: string
  location: Coordinates
  timezone: string
  wheelchairAccessible: boolean
}

export interface TransitLine {
  id: string                  // Transitland route onestop_id
  name: string
  mode: TransitMode
  agencyName: string
  color?: string              // hex, from GTFS route_color
  /** Stations in order, direction 0 (typically toward terminus A) */
  stationsDirection0: Station[]
  /** Stations in order, direction 1 (typically toward terminus B) */
  stationsDirection1: Station[]
}

export interface StationVisit {
  station: Station
  line: Pick<TransitLine, 'id' | 'name' | 'mode' | 'color'>
  directionId: DirectionId
  /** Hop count from origin station (1 = first stop away, 2 = second, etc.) */
  hopsFromOrigin: number
  /** Estimated cumulative ride time from origin station in minutes */
  estimatedRideMinutes: number
}

export interface Departure {
  scheduledTime: string       // HH:MM:SS local time
  realTime?: string           // HH:MM:SS if GTFS-RT available
  tripId: string
  headsign: string
  stopSequence: number
}
```

### 3.2 `src/types/trip.ts` (new file)

```typescript
import { Coordinates } from './geo'
import { Place } from './places'
import { Station, TransitLine, DirectionId, TransitMode } from './transit'

export interface WalkLeg {
  fromLabel: string           // e.g. "Home", "Departure station"
  toLabel: string
  from: Coordinates
  to: Coordinates
  estimatedMinutes: number
}

export interface TransitLeg {
  line: Pick<TransitLine, 'id' | 'name' | 'mode' | 'color'>
  fromStation: Station
  toStation: Station
  directionId: DirectionId
  scheduledDepartureTime: string   // HH:MM:SS
  scheduledArrivalTime: string     // HH:MM:SS
  estimatedRideMinutes: number
}

export interface DwellWindow {
  requestedMinutes: number    // from filter (default 180)
  /** Earliest return departure that satisfies the dwell window */
  earliestReturn: string      // HH:MM:SS
  /** Latest confirmed return departure inside the daylight cutoff */
  latestReturn: string        // HH:MM:SS
  /** How many return departures exist in the window */
  returnCount: number
}

export type FeasibilityStatus =
  | 'feasible'
  | 'no_return_in_window'
  | 'after_daylight_cutoff'
  | 'ride_exceeds_mode_tolerance'
  | 'walk_too_long'

export interface TripFeasibility {
  status: FeasibilityStatus
  /** Human-readable reason, shown on eliminated trip cards */
  reason?: string
}

export interface TripScore {
  total: number               // 0-100
  components: {
    transitAdvantage: number  // transit faster than driving? (0-35)
    walkPenalty: number       // long walks penalize (-20-0)
    desirability: number      // place rating bonus (0-20)
    modePremium: number       // rail > bus premium (0-10)
    returnFlexibility: number // many return options = better (0-15)
  }
}

export interface Trip {
  id: string                  // `${line.id}-${arrivalStation.id}-${place.id}`
  origin: Coordinates

  // Outbound leg
  walkToStation: WalkLeg
  outboundTransit: TransitLeg
  walkToPlace: WalkLeg

  // Destination
  destinationPlace: Place
  dwell: DwellWindow

  // Return leg (mirrors outbound)
  walkToReturnStation: WalkLeg
  returnTransit: TransitLeg
  walkHome: WalkLeg

  feasibility: TripFeasibility
  score?: TripScore           // undefined until scored
  source: 'live' | 'mock'
}
```

### 3.3 Updated `src/types/filters.ts`

Add four fields to `FilterState`. Existing fields stay:

```typescript
// Add to FilterState:
walkToStationMinutes: number        // default 10 — walk budget to departure station
dwellWindowMinutes: number          // default 180 (3 hours)
modePreference: 'all' | 'train' | 'bus'  // default 'all'
daylightCutoff: 'sunset_minus_60' | 'sunset_minus_30' | 'at_sunset' | 'sunset_plus_30' | 'sunset_plus_60' | 'none'
                                    // default 'sunset_plus_30'
```

---

## 4. New Service Architecture

### 4.1 `src/services/transit/transitland.ts` (new)

Three functions, each maps directly to one Transitland REST endpoint.

**Function 1: `fetchNearbyStops`**
```
Endpoint: GET /api/v2/rest/stops
Params:   lat, lon, radius (meters), apikey
Returns:  Station[] with routes_serving_stop embedded
Purpose:  Find all transit stops within the user's walk-to-station budget
```

Walk budget in minutes × 80 m/min = radius in meters (e.g. 10 min × 80 = 800 m).

**Function 2: `fetchStopSequence`**
```
Endpoint: GET /api/v2/rest/routes/{route_onestop_id}/trips?service_date=TODAY&direction_id={0|1}
Then:     GET /api/v2/rest/routes/{route_onestop_id}/trips/{trip_id}
Returns:  Station[] ordered outward from the origin stop position
Purpose:  Get the ordered station list for one line+direction, starting from origin stop
```

Implementation note: fetch the first matching trip for the route+direction, extract its `stop_times` array, sort by `stop_sequence`, find the index of the origin stop, and return all stations *after* that index (outward only).

**Function 3: `fetchDepartures`**
```
Endpoint: GET /api/v2/rest/stops/{stop_onestop_id}/departures
Params:   relative_date=TODAY, start_time, end_time (the feasibility window), apikey
Returns:  Departure[] for a specific stop, optionally filtered by route
Purpose:  Validate return trip feasibility and find last return time
```

### 4.2 `src/services/trips/tripBuilder.ts` (new)

The main orchestrator. Replaces the `useEffect` logic currently inside `App.tsx`. Returns `Trip[]`.

**Algorithm:**

```
buildTrips(origin, filters, apiKeys):

1. walkRadiusMeters = filters.walkToStationMinutes * 80
   originStops = fetchNearbyStops(origin, walkRadiusMeters, transitlandKey)

2. For each originStop:
   For each route in originStop.routes_serving_stop:
     If filters.modePreference excludes this route type: skip
     
     For directionId in [0, 1]:
       stations = fetchStopSequence(route.onestop_id, directionId, originStop, transitlandKey)
       
       cumulativeRideMinutes = 0
       For each station in stations (outward from origin):
         cumulativeRideMinutes += estimateSegmentTime(prevStation, station, route.mode)
         
         If cumulativeRideMinutes > modeRideCap[route.mode]: break
         
         If overlapsWithPreviousStation(station, prevStation): continue  // skip Places call
         
         places = fetchGoogleNearby({ origin: station.location, ... })
         
         For each place in places:
           departures = fetchDepartures(station, feasibilityWindow, route, transitlandKey)
           feasibility = checkFeasibility(departures, dwell, daylightCutoff, origin)
           
           walkToStation = estimateWalk(origin, originStop.location)
           walkToPlace   = estimateWalk(station.location, place.location)
           
           trip = assembleTripObject(...)
           trips.push(trip)

3. Return trips (feasible first, infeasible last)
```

### 4.3 `src/services/trips/feasibilityGate.ts` (new)

Pure function. Given a set of departures from the return station and the user's constraints, determines feasibility.

```
checkFeasibility(
  outboundArrivalTime: string,     // when user arrives at destination station
  dwellWindowMinutes: number,
  daylightCutoff: DaylightCutoff,
  departures: Departure[],         // return departures from arrival station
  walkHomeMinutes: number,         // station-to-origin walk time
  date: Date
): TripFeasibility
```

**Logic:**
1. Earliest acceptable return departure = `outboundArrivalTime + dwellWindowMinutes` (in minutes arithmetic)
2. Latest acceptable return departure = `sunset(date, origin) + daylightCutoffOffset - walkHomeMinutes`
3. Filter `departures` to those between earliest and latest
4. If none: `{ status: 'no_return_in_window', reason: 'No return departure within your dwell window' }`
5. Else: `{ status: 'feasible' }` with `latestReturn` and `returnCount` populated

Sunset calculation: use the `suncalc` npm package (lightweight, no API call needed).

### 4.4 `src/services/scoring/tripScore.ts` (new, replaces `closishScore.ts`)

```
scoreTrip(trip: Trip, filters: FilterState): TripScore
```

**Component mapping (preserving v1 intent):**

| Component | v1 equivalent | v2 logic |
|---|---|---|
| `transitAdvantage` | `transitBias` | (estimated drive minutes − total transit minutes) × 2.5, capped 0–35 |
| `walkPenalty` | `walkPenalty` | Penalizes total walk > `maxWalkMinutes` or > `walkToStationMinutes`, −20–0 |
| `desirability` | `desirability` | `(place.rating − 3.5) × 10`, 0–20 |
| `modePremium` | (new) | Rail modes +10, ferry +8, bus +0 |
| `returnFlexibility` | (new) | `min(dwell.returnCount, 5) × 3`, rewards many return options |

Total = sum of components, clamped 0–100.

---

## 5. Updated Filter State

New filter defaults to add to `src/types/filters.ts`:

```typescript
export const filterDefaults: FilterState = {
  // --- v1 filters (unchanged) ---
  liveMode: true,
  placeType: 'restaurants',
  when: 'now',
  walkVsTransit: 'favor_transit',
  maxWalkMinutes: 10,

  // --- v2 new filters ---
  walkToStationMinutes: 10,
  dwellWindowMinutes: 180,
  modePreference: 'all',
  daylightCutoff: 'sunset_plus_30',
}
```

---

## 6. Updated UI Components

### 6.1 `TripCard.tsx` (new, replaces `PlaceCard.tsx`)

Displays one `Trip`. Shows all legs with times. Feasibility-aware styling.

**Feasible trip card shows:**
- Total door-to-door time (prominent)
- Leg breakdown: `5m walk → 25m train → 8m walk` (outbound)
- Destination place name, rating, category
- Dwell window: `3h at destination`
- Return: `Last return: 6:42 PM (4 more options)`
- Mode badge (train/bus/ferry) with line color

**Infeasible trip card shows:**
- Muted/dimmed styling
- Destination name
- Single-line reason tag: `"No return in your 3-hour window"` or `"Would arrive home after sunset"`

**Props:**
```typescript
interface TripCardProps {
  trip: Trip
  selected: boolean
  onSelect: (tripId: string) => void
}
```

### 6.2 `MapView.tsx` (minor updates)

Additions only — existing behavior preserved:
- Add station markers (outbound arrival station, return departure station) as intermediate waypoints
- Show route polyline between origin and destination stations (use line `color` field from Transitland)
- Keep existing origin/device/destination marker logic unchanged

### 6.3 `App.tsx` state changes

**Remove:**
- `places` state (replaced by `trips`)
- `placesSource` state (absorbed into `trip.source`)
- `selectedPlaceId` (replaced by `selectedTripId`)

**Add:**
- `trips: Trip[]`
- `selectedTripId: string | null`
- `loadingPhase: 'idle' | 'stops' | 'traversing' | 'scoring' | 'done'`
  (replaces boolean `loadingPlaces` — enables progressive loading UI)

**Keep:**
- `position`
- `originOverride`
- `filters`
- `isLoaded`

**Main effect** (replaces the current places-fetching effect):
```typescript
useEffect(() => {
  if (!origin || !config.isConfigured) return
  let active = true
  setLoadingPhase('stops')

  buildTrips(origin, filters, apiKeys).then(trips => {
    if (!active) return
    const scored = trips
      .map(t => ({ ...t, score: scoreTrip(t, filters) }))
      .sort((a, b) => {
        // Feasible first, then by score
        if (a.feasibility.status === 'feasible' && b.feasibility.status !== 'feasible') return -1
        if (b.feasibility.status === 'feasible' && a.feasibility.status !== 'feasible') return 1
        return (b.score?.total ?? 0) - (a.score?.total ?? 0)
      })
    setTrips(scored)
    setLoadingPhase('done')
  })

  return () => { active = false }
}, [origin, filters])
```

---

## 7. New Config Constants

Add to `src/config/dataSources.ts`:

```typescript
// Station traversal
export const WALK_SPEED_M_PER_MIN = 80          // meters per minute (~3 mph)
export const PLACE_HALO_RADIUS_M = 800           // radius for overlap detection
export const OVERLAP_SKIP_THRESHOLD = 0.6        // 60% overlap → skip Places call

// Mode ride-time caps (minutes)
export const RIDE_CAP_COMMUTER_RAIL = 60
export const RIDE_CAP_SUBWAY = 40
export const RIDE_CAP_LIGHT_RAIL = 35
export const RIDE_CAP_BUS = 25
export const RIDE_CAP_FERRY = 45
export const RIDE_CAP_CABLE_CAR = 20

// Trip results
export const TRIPS_TOP_K = 10                    // max trips shown (feasible first)

// Dwell window
export const DEFAULT_DWELL_MINUTES = 180         // 3 hours
```

---

## 8. New Dependency

One new npm package is needed:

```bash
npm install suncalc
npm install --save-dev @types/suncalc
```

`suncalc` computes sunrise/sunset times from a lat/lng + date. It is a pure browser-safe library with no network calls. Used only in `feasibilityGate.ts`.

---

## 9. Phased Implementation Sequence

Work in this order. Each phase is independently testable before moving to the next.

---

### Phase 1 — Types

**Goal:** Define all data shapes. No functional code yet.

1. Create `src/types/transit.ts` (§3.1)
2. Create `src/types/trip.ts` (§3.2)
3. Update `src/types/filters.ts` — add four new fields and update `filterDefaults`
4. Update `src/config/dataSources.ts` — add new constants

**Test:** TypeScript compiles cleanly. No runtime impact.

---

### Phase 2 — Transitland Service

**Goal:** Prove you can fetch real data from Transitland.

1. Add `VITE_TRANSITLAND_API_KEY` to `.env.local`
2. Create `src/services/transit/transitland.ts` with three functions
3. In browser console (or a temporary debug component), call `fetchNearbyStops` for your home address and log the result

**Test:** Manually verify that real stops appear with correct names and routes. Check the free tier rate limit isn't blown by development calls (cache aggressively in dev — the stop list for a given origin+radius is static).

**Implementation note on the trip sequence fetch:** Transitland's trip endpoint requires a `service_date` parameter. Use `TODAY` for the relative date. Fetch one representative trip per route+direction (the first result). The stop sequence is geometrically stable — it only changes if the agency modifies the route.

---

### Phase 3 — Trip Builder (stub version)

**Goal:** Wire the traversal loop without Places calls. Return `StationVisit[]` to verify the traversal bounds work.

1. Create `src/services/trips/tripBuilder.ts`
2. Implement only the station-traversal portion: stops → lines → direction loop → station list
3. Apply mode caps and overlap detection
4. Log the `StationVisit[]` to console

**Test:** For your home origin, verify that the traversal terminates at the right depth for each line. For a commuter rail line, you should see ~8–15 stations. For a local bus, ~5–8.

---

### Phase 4 — Feasibility Gate

**Goal:** Given a station and a time window, determine if the trip is returnable.

1. Install `suncalc` (`npm install suncalc @types/suncalc`)
2. Create `src/services/trips/feasibilityGate.ts`
3. Write a quick test: pick a real station, pick a departure time, call `checkFeasibility`, log the result

**Test:** Verify that a late-night trip (e.g. last bus at 10 PM, dwell = 3 hours, departure at 8 PM) correctly returns `no_return_in_window`. Verify a midday trip returns `feasible` with populated return times.

---

### Phase 5 — Full Trip Builder (with Places)

**Goal:** Complete `tripBuilder.ts` end-to-end, producing real `Trip[]`.

1. Add Places calls per station inside the traversal loop
2. Add walking leg estimation (Haversine-based, same as existing `googlePlaces.ts` approach)
3. Add feasibility gate call per candidate trip
4. Return assembled `Trip[]` (unscored)

**Test:** Call `buildTrips` from the browser console with a real origin. Verify you get a mix of feasible and infeasible trips across different modes.

**API budget check:** With 3 origin stops × 2 lines each × 2 directions × 8 stations per direction, you're looking at ~96 Places calls per search. This is high. Apply overlap detection aggressively. Consider caching Places results by station `onestop_id` in a `Map<string, Place[]>` within the session.

---

### Phase 6 — Trip Scorer

**Goal:** Produce ranked `TripScore` for every `Trip`.

1. Create `src/services/scoring/tripScore.ts`
2. Implement scoring components per §4.4
3. Do not delete `closishScore.ts` yet

**Test:** Run scorer over your Phase 5 trip results. Verify that commuter-rail trips to distant parks score higher than slow bus trips to nearby mediocre restaurants.

---

### Phase 7 — UI: TripCard

**Goal:** Replace `PlaceCard` with `TripCard` in isolation.

1. Create `src/components/TripCard.tsx`
2. Temporarily render one hardcoded `Trip` (from mock data) to verify the layout
3. Wire the feasibility-aware styling (muted + reason tag for infeasible)

**Test:** Visual inspection. Check that all legs are readable on mobile screen width.

---

### Phase 8 — App.tsx Wiring

**Goal:** Connect everything into the running app.

1. Update `App.tsx` state shape (remove `places`, add `trips`/`selectedTripId`/`loadingPhase`)
2. Replace the places-fetching `useEffect` with the trip-building effect (§6.3)
3. Replace `PlaceCard` render with `TripCard`
4. Add new filter controls to the filter panel (walk to station, dwell window, mode preference, daylight cutoff)
5. Add Transitland attribution link to footer/header

**Test:** Full end-to-end with live APIs. Verify that:
- Loading phase transitions are visible to the user
- Feasible trips appear first
- Infeasible trips appear below with reason labels
- Selecting a trip updates the map

---

### Phase 9 — MapView Updates

**Goal:** Show station markers and route line on the map.

1. Add station marker(s) to `MapView.tsx` — a distinct pin style from origin/destination
2. Add route polyline between origin station and destination station (use line `color` from Transitland)
3. Update map bounds logic to encompass origin + departure station + arrival station + place

**Test:** Verify the map recenters correctly when a trip is selected, including the transit corridor.

---

### Phase 10 — Cleanup

**Goal:** Remove v1 artifacts.

1. Delete `src/components/PlaceCard.tsx`
2. Delete `src/services/scoring/closishScore.ts`
3. Update mock data in `src/services/places/mockPlaces.ts` to return mock `Trip[]` instead of `Place[]`
4. Run `npm run lint` and fix any remaining type errors
5. Run `npm run build` — verify clean build

---

## 10. API Call Budget Per Search

Approximate call count per user search:

| Step | Calls | Notes |
|---|---|---|
| Transitland: nearby stops | 1 | Returns stops + routes embedded |
| Transitland: stop sequences | N_lines × 2 directions | Typically 2–6 lines × 2 = 4–12 calls |
| Transitland: departures | N_stations (feasibility gate) | Bounded by ride-time cap; typically 20–60 calls |
| Google Places: nearby | N_stations after dedup | Typically 15–40 calls (overlap detection helps) |
| Google Routes: walking legs | 0–N_trips (optional) | Only if Routes API key is configured; falls back to Haversine |

**Monthly budget estimate (free tiers):**
- Transitland free: 10,000 calls/month ÷ ~70 calls/search = ~140 searches/month. This is tight for a production app. For development, cache stop sequences aggressively (they are static for a given route).
- Google Places: usage costs apply per call. The v2 pattern issues many more Places calls than v1. Consider Places caching by station ID.

**Recommendation:** Add a simple in-memory session cache for both Transitland stop sequences and Places results, keyed by `stationOnestopId`. These are deterministic for a given date and don't need invalidation within a session.

---

## 11. Risk Register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Transitland free tier exhausted during dev | Medium | Cache all Transitland responses in memory during dev. Use real API only for integration tests. |
| Transitland has no data for user's area | Low-Medium | Check coverage at transit.land before building. NCTD (Coaster, BREEZE) and Metrolink are in Transitland. |
| Google Places call volume too high | Medium | Overlap detection, session caching by station ID. |
| `suncalc` sunset times off by timezone | Low | Always pass the origin `Coordinates` to `suncalc`; never assume local machine timezone. |
| Trip builder too slow (user perceives hang) | Medium | Show progressive loading: "Finding stations…" → "Checking routes…" → "Building trips…" using `loadingPhase` state. |
| `App.tsx` becomes unmanageable | Low-Medium | If it exceeds ~500 lines after v2 wiring, extract trip state into a `useTrips()` custom hook. |

---

## 12. Deferred (Explicitly Out of Scope)

Per proposal §9, not in this pass:
- Multi-leg / transfer trips
- Park-and-ride
- Capacitor / native iOS / Android wrap
- Activity-sequence suggestions within the dwell window
- User-exposed ride-time tolerance sliders per mode
- SpotHero parking integration
