# CLO-001 — Types Foundation

| Field | Value |
|---|---|
| **Status** | To Do |
| **Type** | Chore |
| **Phase** | 1 of 10 |
| **Depends on** | Nothing — start here |
| **Blocks** | All other stories |

---

## Summary

Define all new TypeScript types that the v2 redesign requires. No functional code is written in this story — only type definitions and updated constants. This story is complete when the project compiles cleanly with the new types in place.

---

## Background

The v2 redesign changes the primary data unit from `Place` (a single destination) to `Trip` (a complete round-trip plan: walk → transit → activity → transit → walk). All downstream services, components, and scoring logic speak in terms of `Trip`. Getting the types right first prevents cascading refactors later.

The existing types (`geo.ts`, `places.ts`, `filters.ts`) are not deleted in this story — they stay as dependencies of the new `Trip` type.

See: `docs/closeish_v2/03-implementation-plan.md` §3 (New Type Definitions) and §7 (New Config Constants).

---

## Acceptance Criteria

- [ ] `src/types/transit.ts` is created with: `TransitMode`, `DirectionId`, `Station`, `TransitLine`, `StationVisit`, `Departure`
- [ ] `src/types/trip.ts` is created with: `WalkLeg`, `TransitLeg`, `DwellWindow`, `FeasibilityStatus`, `TripFeasibility`, `TripScore`, `Trip`
- [ ] `src/types/filters.ts` has four new fields added to `FilterState`: `walkToStationMinutes`, `dwellWindowMinutes`, `modePreference`, `daylightCutoff`
- [ ] `filterDefaults` in `filters.ts` is updated with sensible defaults for the four new fields
- [ ] `src/config/dataSources.ts` has new constants added: `WALK_SPEED_M_PER_MIN`, `PLACE_HALO_RADIUS_M`, `OVERLAP_SKIP_THRESHOLD`, all five `RIDE_CAP_*` constants, `TRIPS_TOP_K`, `DEFAULT_DWELL_MINUTES`
- [ ] No existing types or constants are removed
- [ ] `npm run build` passes with zero TypeScript errors
- [ ] `npm run lint` passes with zero new errors

---

## Technical Notes

### New filter fields and their defaults

```typescript
walkToStationMinutes: number        // default: 10
dwellWindowMinutes: number          // default: 180
modePreference: 'all' | 'train' | 'bus'   // default: 'all'
daylightCutoff: 'sunset_minus_60' | 'sunset_minus_30' | 'at_sunset' | 'sunset_plus_30' | 'sunset_plus_60' | 'none'
                                    // default: 'sunset_plus_30'
```

### New config constants

```typescript
export const WALK_SPEED_M_PER_MIN = 80
export const PLACE_HALO_RADIUS_M = 800
export const OVERLAP_SKIP_THRESHOLD = 0.6
export const RIDE_CAP_COMMUTER_RAIL = 60
export const RIDE_CAP_SUBWAY = 40
export const RIDE_CAP_LIGHT_RAIL = 35
export const RIDE_CAP_BUS = 25
export const RIDE_CAP_FERRY = 45
export const RIDE_CAP_CABLE_CAR = 20
export const TRIPS_TOP_K = 10
export const DEFAULT_DWELL_MINUTES = 180
```

### `Trip.id` convention

```typescript
id: `${line.id}-${arrivalStation.id}-${place.id}`
```

### `TransitMode` to GTFS `route_type` mapping

| `TransitMode` | GTFS `route_type` |
|---|---|
| `light_rail` | 0 |
| `subway` | 1 |
| `commuter_rail` | 2 |
| `bus` | 3 |
| `ferry` | 4 |
| `cable_car` | 5 |

---

## Claude Implementation Guide

### Context files to read first

Tell Claude to read these before writing any code:

```
Please read these files:
1. docs/claude_analysis/codebase-overview.md
2. docs/closeish_v2/03-implementation-plan.md
3. src/types/geo.ts
4. src/types/places.ts
5. src/types/filters.ts
6. src/config/dataSources.ts
```

### Prompt to paste

```
We are implementing CLO-001: Types Foundation.

Please implement the following changes exactly as specified in 
docs/closeish_v2/03-implementation-plan.md §3 and §7:

1. Create src/types/transit.ts with the types defined in §3.1
2. Create src/types/trip.ts with the types defined in §3.2
   - Trip.id convention: `${line.id}-${arrivalStation.id}-${place.id}`
3. Update src/types/filters.ts:
   - Add the four new fields to FilterState (§3.3)
   - Update filterDefaults with the defaults listed in §5
4. Update src/config/dataSources.ts:
   - Add all new constants from §7
   - Do not remove any existing constants

Do not create any service files or components in this story.
Do not modify App.tsx, any components, or any existing service files.
After making changes, confirm that `npm run build` passes.
```

### Files Claude should produce

| File | Action |
|---|---|
| `src/types/transit.ts` | Create |
| `src/types/trip.ts` | Create |
| `src/types/filters.ts` | Modify (add fields only) |
| `src/config/dataSources.ts` | Modify (add constants only) |
