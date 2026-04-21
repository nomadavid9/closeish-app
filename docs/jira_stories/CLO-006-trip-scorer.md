# CLO-006 — Trip Scorer

| Field | Value |
|---|---|
| **Status** | To Do |
| **Type** | Feature |
| **Phase** | 6 of 10 |
| **Depends on** | CLO-001 |
| **Blocks** | CLO-008 |

---

## Summary

Create `src/services/scoring/tripScore.ts` — a pure function that scores a complete `Trip` on a 0–100 scale. This replaces `closishScore.ts` (which scores individual places) with a richer scorer that operates on the full round-trip. The existing scoring concepts (transit-beats-driving, walk penalty, desirability from ratings) carry over, extended with two new components: mode premium and return flexibility.

---

## Background

In v1, `closishScore.ts` rewards places that are significantly faster by transit than by driving, penalizes long walks, and adds a small bonus for highly-rated places. In v2, the unit of recommendation is a `Trip` (full round-trip with all legs), and the scorer needs to account for the richness of that data: what mode is used, how many return trips are available, and how the full door-to-door time compares to driving.

`closishScore.ts` is not deleted in this story — deletion happens in CLO-010. Both scoring functions coexist temporarily.

See: `docs/closeish_v2/03-implementation-plan.md` §4.4 (Trip Scorer).

---

## Acceptance Criteria

- [ ] `src/services/scoring/tripScore.ts` is created and exports `scoreTrip(trip: Trip, filters: FilterState): TripScore`
- [ ] Scoring has five components: `transitAdvantage`, `walkPenalty`, `desirability`, `modePremium`, `returnFlexibility`
- [ ] `transitAdvantage`: `(estimatedDriveMinutes − totalTransitMinutes) * 2.5`, clamped 0–35. Drive estimate = total transit minutes * 1.4 (transit is assumed to be ~40% slower than driving in v2 baseline)
- [ ] `walkPenalty`: penalizes total walk minutes (walkToStation + walkToPlace + walkHome) exceeding `filters.maxWalkMinutes`; range −20–0
- [ ] `desirability`: `(place.rating − 3.5) * 10`, clamped 0–20; 0 if no rating
- [ ] `modePremium`: commuter_rail/subway → 10, light_rail/ferry → 8, bus → 0, cable_car → 5
- [ ] `returnFlexibility`: `Math.min(trip.dwell.returnCount, 5) * 3`, range 0–15
- [ ] `TripScore.total` = sum of all components, clamped 0–100
- [ ] Infeasible trips (`trip.feasibility.status !== 'feasible'`) score 0 for all components
- [ ] A helper `estimateDriveMinutes(trip: Trip): number` is included (Haversine origin-to-place distance / assumed drive speed)
- [ ] `npm run build` passes

---

## Technical Notes

### Component weights and ranges

```typescript
// Target ranges:
transitAdvantage:   0 to 35  (transit advantage over driving)
walkPenalty:      -20 to  0  (penalizes long total walk)
desirability:       0 to 20  (place rating bonus)
modePremium:        0 to 10  (rail is more pleasant than bus)
returnFlexibility:  0 to 15  (many return options = more freedom)
// Total range: -20 to 80 before clamping → clamp to 0-100
```

### Drive time estimate

```typescript
function estimateDriveMinutes(trip: Trip): number {
  const directKm = haversineKm(trip.origin, trip.destinationPlace.location)
  const DRIVE_SPEED_KM_PER_MIN = 0.6   // ~36 km/h (urban with traffic)
  return directKm / DRIVE_SPEED_KM_PER_MIN
}
```

### Walk penalty

```typescript
const totalWalkMinutes =
  trip.walkToStation.estimatedMinutes +
  trip.walkToPlace.estimatedMinutes +
  trip.walkHome.estimatedMinutes

const excessWalk = Math.max(0, totalWalkMinutes - filters.maxWalkMinutes)
const walkPenalty = Math.max(-20, -(excessWalk * 1.5))
```

### Mode premium values

```typescript
const MODE_PREMIUM: Record<TransitMode, number> = {
  commuter_rail: 10,
  subway:        10,
  light_rail:     8,
  ferry:          8,
  cable_car:      5,
  bus:            0,
}
```

---

## Claude Implementation Guide

### Context files to read first

```
Please read these files:
1. docs/closeish_v2/03-implementation-plan.md  (§4.4 — Trip Scorer)
2. src/types/trip.ts       (Trip, TripScore)
3. src/types/filters.ts    (FilterState)
4. src/types/transit.ts    (TransitMode)
5. src/services/scoring/closishScore.ts  (v1 scorer — for conceptual reference)
```

### Prompt to paste

```
We are implementing CLO-006: Trip Scorer.

Create src/services/scoring/tripScore.ts with:

1. A helper haversineKm(a: Coordinates, b: Coordinates): number
   (reuse the same formula as in googlePlaces.ts if you check that file)

2. A helper estimateDriveMinutes(trip: Trip): number
   Uses Haversine distance origin→place / 0.6 km/min (urban drive speed)

3. The main export: scoreTrip(trip: Trip, filters: FilterState): TripScore

   Five components:
   - transitAdvantage: (estimateDriveMinutes - totalTransitMinutes) * 2.5, clamped 0-35
     totalTransitMinutes = outboundTransit.estimatedRideMinutes + returnTransit.estimatedRideMinutes
   - walkPenalty: penalize total walk (all three walk legs) exceeding filters.maxWalkMinutes
     formula: max(-20, -(excessWalkMinutes * 1.5)), range -20 to 0
   - desirability: (place.rating - 3.5) * 10, clamped 0-20, 0 if no rating
   - modePremium: commuter_rail/subway=10, light_rail/ferry=8, cable_car=5, bus=0
   - returnFlexibility: min(dwell.returnCount, 5) * 3, range 0-15
   
   total = clamp(sum of components, 0, 100)

   If trip.feasibility.status !== 'feasible': all components = 0, total = 0

Do not delete or modify closishScore.ts — it will be removed in a later story.
Do not modify any other files.
```

### Files Claude should produce

| File | Action |
|---|---|
| `src/services/scoring/tripScore.ts` | Create |
