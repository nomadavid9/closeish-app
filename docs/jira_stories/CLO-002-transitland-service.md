# CLO-002 — Transitland Service

| Field | Value |
|---|---|
| **Status** | To Do |
| **Type** | Feature |
| **Phase** | 2 of 10 |
| **Depends on** | CLO-001 |
| **Blocks** | CLO-003, CLO-005 |

---

## Summary

Create the Transitland API service: a new file `src/services/transit/transitland.ts` with three functions that cover stop discovery, stop-sequence fetching, and departure fetching. This is the data foundation for the entire v2 trip-building pipeline.

---

## Background

Transitland is a federated transit data aggregator with a free REST API (10,000 calls/month). It provides what Google APIs cannot: the ordered station list along a line, which lines serve a given stop, and schedule data for return-trip feasibility checks.

**API base URL:** `https://transit.land/api/v2/rest`  
**Auth:** `?apikey=YOUR_KEY` query param or `apikey:` header  
**New env var required:** `VITE_TRANSITLAND_API_KEY` in `.env.local`

See: `docs/closeish_v2/03-implementation-plan.md` §4.1 (Transitland Service).

---

## Acceptance Criteria

- [ ] `src/services/transit/transitland.ts` is created with three exported functions: `fetchNearbyStops`, `fetchStopSequence`, `fetchDepartures`
- [ ] `fetchNearbyStops(origin, walkMinutes, apiKey)` calls `GET /api/v2/rest/stops` with `lat`, `lon`, `radius` params and returns `Station[]` with their serving routes embedded
- [ ] `fetchStopSequence(routeOnestopId, directionId, originStop, apiKey)` fetches one representative trip for the route+direction, extracts its ordered stop list, and returns only the stations *after* the origin stop (outward stations)
- [ ] `fetchDepartures(stopOnestopId, startTime, endTime, apiKey, routeOnestopId?)` calls the departures endpoint and returns `Departure[]` within the time window
- [ ] Walk radius is calculated as `walkMinutes * WALK_SPEED_M_PER_MIN` (from `dataSources.ts`)
- [ ] All three functions handle network errors gracefully (throw descriptive errors, not raw `fetch` rejections)
- [ ] `VITE_TRANSITLAND_API_KEY` is documented in a comment at the top of the file
- [ ] The file includes a note about the free tier 10,000 call/month limit
- [ ] `npm run build` passes

---

## Technical Notes

### Transitland REST endpoints used

**Stops near origin:**
```
GET https://transit.land/api/v2/rest/stops
  ?lat={lat}&lon={lng}&radius={meters}&apikey={key}
```
Response: `{ stops: [ { onestop_id, name, geometry: { coordinates: [lng, lat] }, timezone, wheelchair_accessible, routes_serving_stop: [...] } ] }`

**Stop sequence for a route+direction:**
```
Step 1: GET /api/v2/rest/routes/{route_onestop_id}/trips
          ?relative_date=TODAY&direction_id={0|1}&apikey={key}
        → pick first trip in results

Step 2: GET /api/v2/rest/routes/{route_onestop_id}/trips/{trip_id}
          ?apikey={key}
        → use stop_times array, sort by stop_sequence
        → find index of originStop.id, return stations after that index
```

**Departures from a stop:**
```
GET https://transit.land/api/v2/rest/stops/{stop_onestop_id}/departures
  ?relative_date=TODAY&start_time={HH:MM:SS}&end_time={HH:MM:SS}&apikey={key}
```
Response: `{ departures: [ { scheduled_time, real_time?, trip: { trip_id, headsign }, route: { onestop_id }, stop_sequence } ] }`

### Mapping Transitland `route_type` to `TransitMode`

```typescript
function mapRouteType(routeType: string | number): TransitMode {
  switch (String(routeType)) {
    case '0': return 'light_rail'
    case '1': return 'subway'
    case '2': return 'commuter_rail'
    case '3': return 'bus'
    case '4': return 'ferry'
    case '5': return 'cable_car'
    default:  return 'bus'
  }
}
```

### Rate limit guard (development)

Add a comment block at the top of the file:
```typescript
// RATE LIMIT: Transitland free tier = 10,000 REST calls/month
// During development, cache stop sequences in memory (they are static per route).
// Use a module-level Map<string, Station[]> keyed by `${routeOnestopId}-${directionId}`.
```

Implement a module-level in-memory cache for `fetchStopSequence` results. Key: `${routeOnestopId}-${directionId}`. This prevents re-fetching the same stop sequence on every user search.

---

## Claude Implementation Guide

### Context files to read first

```
Please read these files:
1. docs/claude_analysis/codebase-overview.md
2. docs/closeish_v2/03-implementation-plan.md  (focus on §4.1)
3. src/types/transit.ts                         (from CLO-001)
4. src/types/geo.ts
5. src/config/dataSources.ts                    (for WALK_SPEED_M_PER_MIN)
6. src/services/places/googlePlaces.ts          (for the fetch pattern to follow)
```

### Prompt to paste

```
We are implementing CLO-002: Transitland Service.

Create src/services/transit/transitland.ts with three functions as specified 
in docs/closeish_v2/03-implementation-plan.md §4.1.

Requirements:
- fetchNearbyStops(origin: Coordinates, walkMinutes: number, apiKey: string): Promise<Station[]>
  Calls GET /api/v2/rest/stops with radius = walkMinutes * WALK_SPEED_M_PER_MIN
  Maps response to Station[] using the onestop_id as the stable id
  
- fetchStopSequence(routeOnestopId: string, directionId: DirectionId, originStop: Station, apiKey: string): Promise<Station[]>
  Fetches one representative trip for the route+direction (relative_date=TODAY)
  Sorts stop_times by stop_sequence
  Returns only stations AFTER the origin stop position (outward from origin)
  Caches result in a module-level Map<string, Station[]> keyed by `${routeOnestopId}-${directionId}`

- fetchDepartures(stopOnestopId: string, startTime: string, endTime: string, apiKey: string, routeOnestopId?: string): Promise<Departure[]>
  Calls GET /api/v2/rest/stops/{id}/departures with relative_date=TODAY and the time window
  Maps to Departure[]

All functions should throw descriptive errors (include HTTP status and endpoint in the message).
Add a rate-limit comment block at the top of the file.
Do not modify any other files.
```

### Files Claude should produce

| File | Action |
|---|---|
| `src/services/transit/transitland.ts` | Create |
