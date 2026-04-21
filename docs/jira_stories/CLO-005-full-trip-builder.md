# CLO-005 — Full Trip Builder

| Field | Value |
|---|---|
| **Status** | To Do |
| **Type** | Feature |
| **Phase** | 5 of 10 |
| **Depends on** | CLO-002, CLO-003, CLO-004 |
| **Blocks** | CLO-008 |

---

## Summary

Complete `src/services/trips/tripBuilder.ts` end-to-end: add Google Places calls per station, walking leg estimation, feasibility gate calls, and full `Trip` object assembly. After this story, `buildTrips()` is the single function `App.tsx` calls to get back a complete `Trip[]`.

---

## Background

CLO-003 built the skeleton: a traversal loop that visits stations and knows when to stop. This story layers on everything else — Places calls at each station, walking leg estimation (Haversine, same approach as current v1), feasibility validation for the return journey, and assembly of the full `Trip` data structure.

The Places call still uses the existing `fetchGoogleNearby` from `googlePlaces.ts`, but it is now called per station (at the station's coordinates) rather than once at the user's origin.

See: `docs/closeish_v2/03-implementation-plan.md` §4.2 (Full algorithm), §10 (API budget).

---

## Acceptance Criteria

- [ ] `buildTrips(origin, filters, apiKeys): Promise<Trip[]>` is exported from `tripBuilder.ts`
- [ ] `apiKeys` parameter is `{ transitland: string; places: string; routes?: string }`
- [ ] For each non-overlapping `StationVisit`, `fetchGoogleNearby` is called with the station's coordinates as the origin
- [ ] Overlapping stations (`overlapped: true` from CLO-003) do not trigger a Places call
- [ ] Walking legs are estimated using Haversine distance / `WALK_SPEED_M_PER_MIN`
- [ ] For each place at each station, `fetchDepartures` is called to get return departures within the feasibility window
- [ ] `checkFeasibility` is called for each candidate trip
- [ ] Full `Trip` objects are assembled with all fields populated (outbound legs, dwell, return legs, feasibility)
- [ ] A session-level cache (`Map<string, Place[]>`) prevents re-fetching Places for the same station in the same session
- [ ] Feasible trips and infeasible trips are both included in the return value (infeasible trips still render, with reason labels)
- [ ] `buildTrips` logs `console.debug` output summarizing: stations visited, Places calls made, trips assembled, feasible count
- [ ] `npm run build` passes

---

## Technical Notes

### `apiKeys` type

```typescript
interface TripBuilderApiKeys {
  transitland: string
  places: string
  routes?: string   // optional — walking legs fall back to Haversine if not provided
}
```

### Walk leg estimation

Use Haversine distance (already implemented in `googlePlaces.ts` — reuse or extract the function):

```typescript
function haversineKm(a: Coordinates, b: Coordinates): number { ... }

function estimateWalkMinutes(from: Coordinates, to: Coordinates): number {
  return (haversineKm(from, to) * 1000) / WALK_SPEED_M_PER_MIN
}
```

### Places call per station

```typescript
// Call fetchGoogleNearby at the STATION's coordinates, not the user's origin
const places = await fetchGoogleNearby({
  origin: stationVisit.station.location,   // ← station, not origin
  apiKey: apiKeys.places,
  category: filters.placeType,
  radiusMeters: PLACE_HALO_RADIUS_M,
  maxResults: 10,                          // smaller per-station limit
})
```

### Trip assembly

```typescript
const trip: Trip = {
  id: `${stationVisit.line.id}-${stationVisit.station.id}-${place.id}`,
  origin,
  walkToStation: {
    fromLabel: 'Origin',
    toLabel: stationVisit.station.name,     // origin stop name
    from: origin,
    to: originStop.location,
    estimatedMinutes: estimateWalkMinutes(origin, originStop.location),
  },
  outboundTransit: {
    line: stationVisit.line,
    fromStation: originStop,
    toStation: stationVisit.station,
    directionId: stationVisit.directionId,
    scheduledDepartureTime: '',             // populated from departures if available
    scheduledArrivalTime: '',
    estimatedRideMinutes: stationVisit.estimatedRideMinutes,
  },
  walkToPlace: { ... },
  destinationPlace: place,
  dwell: {
    requestedMinutes: filters.dwellWindowMinutes,
    earliestReturn: ...,    // from feasibility gate validDepartures
    latestReturn: ...,
    returnCount: validDepartures.length,
  },
  walkToReturnStation: { ... },  // same as walkToPlace, reversed
  returnTransit: { ... },         // reverse of outboundTransit
  walkHome: { ... },              // reverse of walkToStation
  feasibility: feasibility,
  source: 'live',
}
```

### Handling the feasibility time window

The feasibility gate needs `outboundArrivalTime`. Since we don't have exact schedule data in the traversal, estimate:

```
departureTime ≈ now
arrivalTime ≈ now + walkToStation.estimatedMinutes + outboundTransit.estimatedRideMinutes
```

Format as `HH:MM:SS` using the origin's timezone.

---

## Claude Implementation Guide

### Context files to read first

```
Please read these files:
1. docs/claude_analysis/codebase-overview.md
2. docs/closeish_v2/03-implementation-plan.md  (§4.2, §10 — API budget)
3. src/types/trip.ts
4. src/types/transit.ts
5. src/types/filters.ts
6. src/config/dataSources.ts
7. src/services/trips/tripBuilder.ts        (from CLO-003 — the stub)
8. src/services/trips/feasibilityGate.ts    (from CLO-004)
9. src/services/transit/transitland.ts      (from CLO-002)
10. src/services/places/googlePlaces.ts     (existing — for the fetch pattern)
```

### Prompt to paste

```
We are implementing CLO-005: Full Trip Builder.

Extend src/services/trips/tripBuilder.ts (built in CLO-003) to be the full 
end-to-end trip builder.

Add the main export:
  buildTrips(
    origin: Coordinates,
    filters: FilterState,
    apiKeys: { transitland: string; places: string; routes?: string }
  ): Promise<Trip[]>

This function should:
1. Call fetchNearbyStops to get origin stops
2. Call traverseStations (from CLO-003) to get StationVisit[]
3. For each non-overlapping StationVisit:
   - Call fetchGoogleNearby at the STATION's coordinates (not the user's origin)
   - Use PLACE_HALO_RADIUS_M as the search radius
   - Cache Places results by station onestop_id in a module-level Map to avoid re-fetching
4. For each place found:
   - Estimate the outbound arrival time (now + walk minutes + ride minutes)
   - Call fetchDepartures for the return window
   - Call checkFeasibility
   - Assemble a full Trip object
5. Return all trips — feasible and infeasible both included

Walking leg estimates use Haversine distance / WALK_SPEED_M_PER_MIN.

Add console.debug logging summarizing: stations visited, Places calls made, 
trips assembled, feasible count.

Only modify tripBuilder.ts. Do not modify any other files.
```

### Files Claude should produce

| File | Action |
|---|---|
| `src/services/trips/tripBuilder.ts` | Modify (complete the stub from CLO-003) |
