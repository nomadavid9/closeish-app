# CLO-010 — v1 Cleanup

| Field | Value |
|---|---|
| **Status** | To Do |
| **Type** | Chore |
| **Phase** | 10 of 10 |
| **Depends on** | CLO-008, CLO-009 |
| **Blocks** | Nothing — final story |

---

## Summary

Remove all v1 artifacts that are no longer used after the v2 migration. This includes the old scoring function, the place card component, and the v1 mock data format. Update the mock data service to return `Trip[]` instead of `Place[]` for offline development. Final story — after this, the codebase has no v1 remnants.

---

## Background

During the v2 migration, several v1 files were deliberately kept to allow parallel coexistence: `PlaceCard.tsx`, `closishScore.ts`, and the `mockPlaces.ts` format. This story removes them and completes the transition.

See: `docs/closeish_v2/03-implementation-plan.md` §2 (What Changes — Deleted section), Phase 10.

---

## Acceptance Criteria

- [ ] `src/components/PlaceCard.tsx` is deleted
- [ ] `src/services/scoring/closishScore.ts` is deleted
- [ ] `src/services/places/mockPlaces.ts` is updated to export `fetchMockTrips(origin: Coordinates | null, filters: FilterState): Promise<Trip[]>` — returns 3–4 hardcoded `Trip` objects that demonstrate feasible and infeasible results across different transit modes
- [ ] All imports of `PlaceCard` and `closishScore` are removed from all files
- [ ] No remaining references to `PlaceCard`, `closishScore`, `scorePlace`, `PlaceScore`, or `placesSource` anywhere in `src/`
- [ ] The mock fallback path in `App.tsx` (or `tripBuilder.ts`) calls `fetchMockTrips` instead of `fetchMockPlaces`
- [ ] The build passes with zero TypeScript errors: `npm run build`
- [ ] ESLint passes with zero errors: `npm run lint`
- [ ] The app runs in mock mode (no API keys) and shows mock trip cards correctly

---

## Technical Notes

### Mock trips to create (4 examples)

Include a variety that exercises the UI:

1. **Feasible commuter rail** — e.g. a trail/park reachable in 28 min by commuter rail, 3 return trips available, score ~72
2. **Feasible local bus** — e.g. a well-rated restaurant, 18 min bus, 6 return trips, score ~48
3. **Infeasible: no return in window** — destination exists but last bus runs too early, reason: "No return departure fits your 3-hour dwell window"
4. **Infeasible: after sunset cutoff** — late-evening destination, reason: "Return would arrive home after your sunset cutoff"

### Mock station data for mock trips

Hardcode two mock stations (same general area as existing mock places — San Francisco-ish):

```typescript
const mockDepartureStation: Station = {
  id: 's-9q8yy-caltrain-22nd',
  name: '22nd Street Caltrain',
  location: { lat: 37.7575, lng: -122.3921 },
  timezone: 'America/Los_Angeles',
  wheelchairAccessible: true,
}
```

### Grep check before deleting

Before deleting `closishScore.ts`, run a search to confirm nothing imports it:

```bash
grep -r "closishScore" src/
grep -r "PlaceCard" src/
grep -r "scorePlace" src/
```

All results should be zero before the delete.

---

## Claude Implementation Guide

### Context files to read first

```
Please read these files:
1. docs/closeish_v2/03-implementation-plan.md  (§2 — deleted files list, Phase 10)
2. src/services/places/mockPlaces.ts           (existing — to understand what's being replaced)
3. src/types/trip.ts                           (for mock Trip shape)
4. src/types/transit.ts                        (for mock Station shape)
5. src/App.tsx                                 (to find mock fallback path and any remaining v1 references)
6. src/services/trips/tripBuilder.ts           (to find where mock fallback should be wired)
```

### Prompt to paste

```
We are implementing CLO-010: v1 Cleanup. This is the final story.

Please do the following in order:

1. Search for all remaining references to PlaceCard, closishScore, scorePlace, 
   PlaceScore, and placesSource in src/. List them before making any changes.

2. Update src/services/places/mockPlaces.ts:
   Replace fetchMockPlaces with fetchMockTrips(origin: Coordinates | null, filters: FilterState): Promise<Trip[]>
   Create 4 mock trips: 2 feasible (one commuter rail, one bus), 2 infeasible (different reasons).
   Use hardcoded station data. The mock trips should look plausible for the San Francisco Bay Area.

3. Update App.tsx (or tripBuilder.ts, wherever the mock fallback is):
   Call fetchMockTrips instead of fetchMockPlaces when operating in mock mode.

4. Delete src/components/PlaceCard.tsx
5. Delete src/services/scoring/closishScore.ts
6. Remove all imports of deleted files from any remaining source files.

7. Run (in your mind, checking the code): npm run build and npm run lint should pass.
   Report any issues you find before I run these commands.

Do not remove types from places.ts that are still used by Trip — specifically 
the Place type is still needed as a dependency of Trip.
```

### Files Claude should produce

| File | Action |
|---|---|
| `src/services/places/mockPlaces.ts` | Modify (replace fetchMockPlaces with fetchMockTrips) |
| `src/App.tsx` or `src/services/trips/tripBuilder.ts` | Modify (wire mock fallback to fetchMockTrips) |
| `src/components/PlaceCard.tsx` | Delete |
| `src/services/scoring/closishScore.ts` | Delete |
