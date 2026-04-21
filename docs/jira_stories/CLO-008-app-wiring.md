# CLO-008 — App.tsx Wiring

| Field | Value |
|---|---|
| **Status** | To Do |
| **Type** | Feature |
| **Phase** | 8 of 10 |
| **Depends on** | CLO-001, CLO-002, CLO-003, CLO-004, CLO-005, CLO-006, CLO-007 |
| **Blocks** | CLO-009, CLO-010 |

---

## Summary

Wire all v2 services and components into `App.tsx`. Replace the places-fetching state and effect with the trip-building pipeline. Update the filter panel with four new controls. Replace `PlaceCard` renders with `TripCard`. Add the Transitland API key to the config block. This is the integration story that makes the v2 app functional end-to-end.

---

## Background

`App.tsx` is the single stateful layer in this app — it is the Angular `AppComponent + Services` combined. The v2 wiring replaces the `places` state and its fetching effect with `trips` state and the `buildTrips` pipeline, while preserving everything that doesn't change: geolocation, origin autocomplete, map loading, and the two-mode render (landing vs. main app).

See: `docs/closeish_v2/03-implementation-plan.md` §6.3 (App.tsx state changes), §5 (Updated Filter State).

---

## Acceptance Criteria

- [ ] `VITE_TRANSITLAND_API_KEY` is read from `import.meta.env` in `App.tsx` alongside the existing API key reads
- [ ] State variable `places: Place[]` is replaced by `trips: Trip[]`
- [ ] State variable `selectedPlaceId` is replaced by `selectedTripId: string | null`
- [ ] State variable `loadingPlaces: boolean` is replaced by `loadingPhase: 'idle' | 'stops' | 'traversing' | 'scoring' | 'done'`
- [ ] State variable `placesSource` is removed (provenance is now in `trip.source`)
- [ ] The places-fetching `useEffect` is replaced by a trip-building effect that calls `buildTrips`
- [ ] Trips are scored with `scoreTrip` inside the effect before being set to state
- [ ] Trips are sorted: feasible first (by score descending), then infeasible (by score descending)
- [ ] The filter panel gains four new controls: walk-to-station slider, dwell window slider, mode preference toggle, daylight cutoff selector
- [ ] `PlaceCard` renders are replaced by `TripCard` renders
- [ ] The selected trip is derived from `selectedTripId` and passed to `MapView` as the selected place (use `trip.destinationPlace` for map marker purposes — MapView signature is unchanged in this story)
- [ ] The loading state shows phase-aware messaging: `"Finding stations…"` / `"Checking routes…"` / `"Building trips…"`
- [ ] Transitland attribution link is visible in the app (footer or header): `"Transit data: Transitland"` linking to `https://www.transit.land`
- [ ] The landing page (no origin) is unchanged
- [ ] `npm run build` passes, `npm run lint` passes

---

## Technical Notes

### New state shape

```typescript
// Remove:
const [places, setPlaces] = useState<Place[]>([])
const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null)
const [loadingPlaces, setLoadingPlaces] = useState(false)
const [placesSource, setPlacesSource] = useState<'mock' | 'live'>('mock')

// Add:
const [trips, setTrips] = useState<Trip[]>([])
const [selectedTripId, setSelectedTripId] = useState<string | null>(null)
const [loadingPhase, setLoadingPhase] = useState<'idle' | 'stops' | 'traversing' | 'scoring' | 'done'>('idle')
```

### New config block additions

```typescript
const config = useMemo(() => ({
  // ... existing keys ...
  transitlandApiKey: import.meta.env.VITE_TRANSITLAND_API_KEY ?? '',
  isTransitlandConfigured: Boolean(import.meta.env.VITE_TRANSITLAND_API_KEY),
}), [])
```

### New trip-building effect

```typescript
useEffect(() => {
  if (!origin || !config.isTransitlandConfigured) return
  let active = true

  setLoadingPhase('stops')
  setTrips([])
  setSelectedTripId(null)

  buildTrips(origin, filters, {
    transitland: config.transitlandApiKey,
    places: config.placesApiKey,
    routes: config.routesApiKey,
  }).then(rawTrips => {
    if (!active) return
    setLoadingPhase('scoring')

    const scored = rawTrips
      .map(t => ({ ...t, score: scoreTrip(t, filters) }))
      .sort((a, b) => {
        const aFeasible = a.feasibility.status === 'feasible'
        const bFeasible = b.feasibility.status === 'feasible'
        if (aFeasible && !bFeasible) return -1
        if (!aFeasible && bFeasible) return 1
        return (b.score?.total ?? 0) - (a.score?.total ?? 0)
      })
      .slice(0, TRIPS_TOP_K)

    setTrips(scored)
    setLoadingPhase('done')
  }).catch(err => {
    console.error('Trip building failed', err)
    setLoadingPhase('done')
  })

  return () => { active = false }
}, [origin, filters])
```

### Passing selected trip to MapView

`MapView` props expect a `selectedPlace?: Place`. Derive it from `selectedTripId`:

```typescript
const selectedTrip = trips.find(t => t.id === selectedTripId) ?? null
// Pass to MapView:
selectedPlace={selectedTrip?.destinationPlace ?? null}
```

MapView itself is not modified in this story (that's CLO-009).

### Loading phase UI

Replace the existing loading spinner text with phase-aware messages:

```typescript
const loadingLabel = {
  idle: '',
  stops: 'Finding stations…',
  traversing: 'Checking routes…',
  scoring: 'Scoring trips…',
  done: '',
}[loadingPhase]
```

### New filter controls

Add to the filter panel (follow existing `<select>` / `<input>` patterns in `App.tsx`):

**Walk to station** (slider, 5–20 min, step 5):
```jsx
<label>Walk to station: {filters.walkToStationMinutes}m
  <input type="range" min={5} max={20} step={5}
    value={filters.walkToStationMinutes}
    onChange={e => setFilter('walkToStationMinutes', Number(e.target.value))} />
</label>
```

**Dwell window** (select: 1h / 2h / 3h / 4h / 5h):
```jsx
<select value={filters.dwellWindowMinutes}
  onChange={e => setFilter('dwellWindowMinutes', Number(e.target.value))}>
  <option value={60}>1 hour</option>
  <option value={120}>2 hours</option>
  <option value={180}>3 hours</option>
  <option value={240}>4 hours</option>
  <option value={300}>5 hours</option>
</select>
```

**Mode preference** (toggle buttons or select): `all` / `train` / `bus`

**Daylight cutoff** (select): human-readable options mapping to the enum values.

---

## Claude Implementation Guide

### Context files to read first

```
Please read these files:
1. docs/claude_analysis/codebase-overview.md
2. docs/closeish_v2/03-implementation-plan.md  (§6.3, §5)
3. src/App.tsx                                  (the full file — critical)
4. src/types/trip.ts
5. src/types/filters.ts
6. src/config/dataSources.ts                    (TRIPS_TOP_K)
7. src/services/trips/tripBuilder.ts            (the buildTrips signature)
8. src/services/scoring/tripScore.ts            (scoreTrip signature)
9. src/components/TripCard.tsx                  (what you'll render)
```

### Prompt to paste

```
We are implementing CLO-008: App.tsx Wiring.

Update src/App.tsx to wire the v2 trip-building pipeline.

Changes required:
1. Read VITE_TRANSITLAND_API_KEY in the config useMemo block
2. Replace state: places→trips, selectedPlaceId→selectedTripId, 
   loadingPlaces→loadingPhase ('idle'|'stops'|'traversing'|'scoring'|'done')
   Remove placesSource state.
3. Replace the places-fetching useEffect with a trip-building effect 
   that calls buildTrips, then scoreTrip on each result, sorts 
   (feasible first, then by score), slices to TRIPS_TOP_K, and sets trips state.
   Use the cleanup pattern: let active = true / return () => { active = false }
4. Replace PlaceCard renders with TripCard renders
5. Pass selected trip's destinationPlace to MapView as selectedPlace 
   (MapView signature is NOT changed in this story)
6. Add four new filter controls to the filter panel: walk-to-station slider, 
   dwell window select, mode preference toggle, daylight cutoff select
7. Update the loading indicator to show phase-aware messages
8. Add a Transitland attribution link: "Transit data: Transitland" 
   linking to https://www.transit.land — in the footer or below the filter panel
9. The landing page (no origin set) should be completely unchanged

Do not change MapView.tsx, App.css structure, or any service files.
Do not delete PlaceCard.tsx or closishScore.ts in this story.
```

### Files Claude should produce

| File | Action |
|---|---|
| `src/App.tsx` | Modify (significant changes) |
| `src/App.css` | Modify (filter control styles, loading phase label styles) |
