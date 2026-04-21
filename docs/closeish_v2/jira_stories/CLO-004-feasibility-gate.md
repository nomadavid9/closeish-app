# CLO-004 — Feasibility Gate

| Field | Value |
|---|---|
| **Status** | To Do |
| **Type** | Feature |
| **Phase** | 4 of 10 |
| **Depends on** | CLO-001 |
| **Blocks** | CLO-005 |

---

## Summary

Create `src/services/trips/feasibilityGate.ts` — a pure function that determines whether a given trip has a valid return journey within the user's constraints (dwell window + daylight cutoff). This is the gate that separates "recommended" trips from "shown but labeled infeasible" trips.

---

## Background

One of the core v2 design principles is that a place is only a valid recommendation if a return trip exists inside the user's time window. This story implements that validation as a pure function that takes a set of departure times from the return station and the user's constraints, and produces a `TripFeasibility` result.

The daylight cutoff is a first-class accessibility feature — it defaults to "home 30 minutes after sunset" to account for users who don't feel safe traveling after dark.

See: `docs/closeish_v2/02-transit-redesign-proposal.md` §2 (Design Principles), §7 (Daylight-Aware Planning).  
See: `docs/closeish_v2/03-implementation-plan.md` §4.3 (Feasibility Gate), §8 (New Dependency: suncalc).

---

## Acceptance Criteria

- [ ] `suncalc` is installed (`npm install suncalc && npm install --save-dev @types/suncalc`)
- [ ] `src/services/trips/feasibilityGate.ts` is created and exports `checkFeasibility`
- [ ] `checkFeasibility` takes: `outboundArrivalTime` (HH:MM:SS), `dwellWindowMinutes`, `daylightCutoff`, `departures: Departure[]`, `walkHomeMinutes`, `date: Date`, `origin: Coordinates`
- [ ] It returns a `TripFeasibility` object with `status` and optional `reason`
- [ ] **Dwell window logic:** earliest acceptable return = `outboundArrivalTime + dwellWindowMinutes`
- [ ] **Daylight logic:** latest acceptable return = `sunset(date, origin) + daylightCutoffOffsetMinutes - walkHomeMinutes`
- [ ] Sunset is calculated using `suncalc.getTimes(date, lat, lng).sunset`
- [ ] If `daylightCutoff === 'none'`, no latest-time constraint is applied
- [ ] If no departures fall within the window: `{ status: 'no_return_in_window', reason: '...' }`
- [ ] If departures exist: `{ status: 'feasible' }` — the calling code populates `DwellWindow` with `earliestReturn`, `latestReturn`, `returnCount`
- [ ] A separate exported helper `daylightCutoffToMinutes(cutoff: DaylightCutoff): number` converts the enum to an offset in minutes (e.g. `'sunset_plus_30'` → `+30`, `'sunset_minus_60'` → `-60`)
- [ ] `npm run build` passes with zero errors

---

## Technical Notes

### `DaylightCutoff` offset mapping

```typescript
export function daylightCutoffToMinutes(cutoff: DaylightCutoff): number {
  switch (cutoff) {
    case 'sunset_minus_60': return -60
    case 'sunset_minus_30': return -30
    case 'at_sunset':       return 0
    case 'sunset_plus_30':  return 30
    case 'sunset_plus_60':  return 60
    case 'none':            return Infinity  // no constraint
  }
}
```

### Time arithmetic

Departure times from Transitland are in `HH:MM:SS` format. Convert to minutes-since-midnight for arithmetic:

```typescript
function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}
```

### Feasibility window logic

```typescript
const earliestReturnMin = toMinutes(outboundArrivalTime) + dwellWindowMinutes
const cutoffOffset = daylightCutoffToMinutes(daylightCutoff)
const sunsetMin = toMinutes(formatTime(suncalc.getTimes(date, origin.lat, origin.lng).sunset))
const latestReturnMin = cutoffOffset === Infinity
  ? Infinity
  : sunsetMin + cutoffOffset - walkHomeMinutes

const validDepartures = departures.filter(d => {
  const t = toMinutes(d.scheduledTime)
  return t >= earliestReturnMin && t <= latestReturnMin
})
```

### `reason` string examples

```
'no_return_in_window'   → 'No return departure fits your 3-hour dwell window'
'after_daylight_cutoff' → 'Return would arrive home after your sunset cutoff'
```

---

## Claude Implementation Guide

### Context files to read first

```
Please read these files:
1. docs/closeish_v2/03-implementation-plan.md  (focus on §4.3 and §8)
2. docs/closeish_v2/02-transit-redesign-proposal.md  (focus on §7 — Daylight Planning)
3. src/types/trip.ts    (TripFeasibility, FeasibilityStatus, DwellWindow)
4. src/types/filters.ts (DaylightCutoff type)
5. src/types/transit.ts (Departure)
6. src/types/geo.ts     (Coordinates)
```

### Prompt to paste

```
We are implementing CLO-004: Feasibility Gate.

First, install suncalc: npm install suncalc && npm install --save-dev @types/suncalc

Then create src/services/trips/feasibilityGate.ts with:

1. A helper: daylightCutoffToMinutes(cutoff: DaylightCutoff): number
   Maps the DaylightCutoff enum to minute offsets. 'none' → Infinity.

2. A helper: toMinutes(time: string): number
   Converts 'HH:MM:SS' to minutes-since-midnight.

3. The main export: checkFeasibility(params: {
     outboundArrivalTime: string,
     dwellWindowMinutes: number,
     daylightCutoff: DaylightCutoff,
     departures: Departure[],
     walkHomeMinutes: number,
     date: Date,
     origin: Coordinates
   }): { feasibility: TripFeasibility; validDepartures: Departure[] }

   Logic:
   - earliest return = toMinutes(outboundArrivalTime) + dwellWindowMinutes
   - sunset = suncalc.getTimes(date, origin.lat, origin.lng).sunset
   - latest return = sunset in minutes + daylightCutoffToMinutes(cutoff) - walkHomeMinutes
   - If daylightCutoff === 'none', no upper bound
   - Filter departures to those in [earliest, latest]
   - If none: { feasibility: { status: 'no_return_in_window', reason: '...' }, validDepartures: [] }
   - If some: { feasibility: { status: 'feasible' }, validDepartures: [...] }

This is a pure function — no API calls, no side effects.
Do not modify any other files.
```

### Files Claude should produce

| File | Action |
|---|---|
| `src/services/trips/feasibilityGate.ts` | Create |
| `package.json` | Modified (suncalc added) |
| `package-lock.json` | Modified |
