# CLO-003 — Trip Builder: Station Traversal Stub

| Field | Value |
|---|---|
| **Status** | To Do |
| **Type** | Feature |
| **Phase** | 3 of 10 |
| **Depends on** | CLO-001, CLO-002 |
| **Blocks** | CLO-005 |

---

## Summary

Create the skeleton of `src/services/trips/tripBuilder.ts` implementing only the station-traversal logic. This story does *not* make Places API calls or assemble full `Trip` objects — it produces `StationVisit[]` so the traversal bounds can be verified against real transit data before committing to the full implementation.

---

## Background

The traversal loop is the most algorithmically novel part of v2. It walks outward from the user's origin along each transit line, station by station, deciding when to stop. Getting this logic right before layering Places calls and trip assembly on top makes debugging much easier.

The traversal has two termination conditions:
1. **Ride-time cap** — cumulative estimated ride time from origin station exceeds the mode-specific cap
2. **Overlap detection** — the destination station's Places halo overlaps the previous station's halo by more than 60%

See: `docs/closeish_v2/03-implementation-plan.md` §1.1 (Traversal Bounding), §4.2 (Trip Builder Algorithm).

---

## Acceptance Criteria

- [ ] `src/services/trips/tripBuilder.ts` is created and exports `traverseStations(originStops, filters, apiKey): Promise<StationVisit[]>`
- [ ] The function fetches the stop sequence for each line + direction from each origin stop
- [ ] Traversal stops when cumulative ride time exceeds the mode cap for that transit mode
- [ ] Overlap detection: if Haversine distance between current and previous station < `PLACE_HALO_RADIUS_M * (1 - OVERLAP_SKIP_THRESHOLD)`, the station is marked `overlapped: true` in the `StationVisit`
- [ ] `StationVisit` objects include: `station`, `line` (id/name/mode/color), `directionId`, `hopsFromOrigin`, `estimatedRideMinutes`, `overlapped`
- [ ] Mode filtering: if `filters.modePreference === 'train'`, skip lines with `mode === 'bus'`; if `'bus'`, skip all rail modes
- [ ] The function logs a summary to `console.debug` showing how many stations were visited per line (to aid development)
- [ ] `npm run build` passes

---

## Technical Notes

### Ride-time estimation per station segment

We don't have actual schedule times in the traversal loop — just the ordered stop list. Estimate segment time using Haversine distance between consecutive stations divided by an assumed speed per mode:

```typescript
const MODE_SPEED_KM_PER_MIN: Record<TransitMode, number> = {
  commuter_rail: 1.2,   // ~72 km/h
  subway: 0.8,          // ~48 km/h
  light_rail: 0.6,      // ~36 km/h
  bus: 0.4,             // ~24 km/h
  ferry: 0.5,           // ~30 km/h
  cable_car: 0.2,       // ~12 km/h
}
```

`segmentMinutes = haversineKm(prevStation, station) / MODE_SPEED_KM_PER_MIN[mode]`

### Overlap detection logic

```typescript
function stationsOverlap(a: Station, b: Station): boolean {
  const distanceM = haversineMeters(a.location, b.location)
  // Two circles of radius PLACE_HALO_RADIUS_M overlap significantly 
  // if the distance between centers < threshold
  return distanceM < PLACE_HALO_RADIUS_M * (1 - OVERLAP_SKIP_THRESHOLD)
}
```

An overlapping station still gets a `StationVisit` (so we know it was considered) but with `overlapped: true`. The Places call will be skipped for overlapping stations in CLO-005.

### `StationVisit` extension for this story

The `StationVisit` type defined in CLO-001 doesn't have an `overlapped` field. Add it:

```typescript
// Extend in traversal output only — don't modify src/types/transit.ts
interface TraversalResult extends StationVisit {
  overlapped: boolean
}
```

---

## Claude Implementation Guide

### Context files to read first

```
Please read these files:
1. docs/claude_analysis/codebase-overview.md
2. docs/closeish_v2/03-implementation-plan.md  (focus on §1.1, §4.2)
3. src/types/transit.ts                         (from CLO-001)
4. src/types/filters.ts                         (from CLO-001)
5. src/config/dataSources.ts                    (all RIDE_CAP_* and OVERLAP_* constants)
6. src/services/transit/transitland.ts          (from CLO-002)
```

### Prompt to paste

```
We are implementing CLO-003: Trip Builder Station Traversal Stub.

Create src/services/trips/tripBuilder.ts.

For now, export only one function:
  traverseStations(
    originStops: Station[],
    filters: FilterState,
    transitlandApiKey: string
  ): Promise<TraversalResult[]>

where TraversalResult extends StationVisit with an added `overlapped: boolean` field.

The algorithm:
1. For each originStop, for each route in its serving routes:
   - Skip the route if filters.modePreference excludes its mode
   - For each directionId (0 and 1):
     - Call fetchStopSequence(route.onestop_id, directionId, originStop, apiKey)
     - Walk the station list outward, tracking cumulativeRideMinutes
     - Estimate each segment using Haversine distance / MODE_SPEED_KM_PER_MIN[mode]
     - Stop when cumulativeRideMinutes > the mode's RIDE_CAP_* constant
     - Detect overlap using haversine distance vs PLACE_HALO_RADIUS_M * (1 - OVERLAP_SKIP_THRESHOLD)
     - Push a TraversalResult for each station visited

2. Use console.debug to log: which lines were traversed, how many stations 
   per line+direction, and how many were overlapped.

Mode speed estimates:
  commuter_rail: 1.2 km/min
  subway: 0.8 km/min
  light_rail: 0.6 km/min
  bus: 0.4 km/min
  ferry: 0.5 km/min
  cable_car: 0.2 km/min

Do not make any Google Places API calls in this story.
Do not assemble Trip objects yet.
```

### Files Claude should produce

| File | Action |
|---|---|
| `src/services/trips/tripBuilder.ts` | Create (partial — traversal only) |
