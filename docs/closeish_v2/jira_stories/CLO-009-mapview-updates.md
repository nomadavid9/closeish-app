# CLO-009 — MapView Updates

| Field | Value |
|---|---|
| **Status** | To Do |
| **Type** | Feature |
| **Phase** | 9 of 10 |
| **Depends on** | CLO-008 |
| **Blocks** | CLO-010 |

---

## Summary

Update `MapView.tsx` to display the full transit corridor for a selected trip: add intermediate station markers (departure station, arrival station) and a polyline showing the transit route between them. Also update the map bounds logic to encompass all points in the selected trip.

---

## Background

In v1, the map shows two points: origin and selected destination. In v2, a trip has more points of interest: the departure station (where the user boards), the arrival station (where the user alights), and the destination place. Showing the station markers and the connecting polyline helps the user understand the transit leg at a glance.

MapView already uses imperative Google Maps API via `useRef` — the station markers and polyline follow the same pattern as the existing `AdvancedMarkerElement` markers.

See: `docs/closeish_v2/03-implementation-plan.md` §6.2 (MapView updates).

---

## Acceptance Criteria

- [ ] `MapView.tsx` accepts a new optional prop: `selectedTrip?: Trip | null`
- [ ] When `selectedTrip` is provided:
  - A station marker is shown at `selectedTrip.outboundTransit.fromStation.location` (departure station)
  - A station marker is shown at `selectedTrip.outboundTransit.toStation.location` (arrival station)
  - A polyline is drawn between the two station markers using `selectedTrip.outboundTransit.line.color` (default navy if null)
  - Map bounds encompass: origin, departure station, arrival station, and destination place
- [ ] Station markers use a distinct visual style from the origin and destination markers (suggest: smaller circle, line color fill, white outline)
- [ ] The polyline is dashed or uses a transit-style stroke (2-3px, 0.85 opacity)
- [ ] When `selectedTrip` is null/undefined, the map behaves exactly as it did before this story
- [ ] Existing origin, device location, and destination markers are unchanged
- [ ] The existing `selectedPlace` prop continues to work for the destination marker
- [ ] Polyline and station markers are cleaned up when the component unmounts or `selectedTrip` changes
- [ ] `npm run build` passes

---

## Technical Notes

### Updated prop signature

```typescript
interface MapViewProps {
  // ... all existing props unchanged ...
  selectedTrip?: Trip | null   // NEW — adds station markers + polyline
}
```

The existing `selectedPlace` prop is kept. In `App.tsx` (from CLO-008), derive `selectedPlace` from `selectedTrip?.destinationPlace` — MapView receives both and handles them separately.

### Station marker implementation

Use the same `AdvancedMarkerElement` pattern already in `MapView.tsx`. For station markers, use a smaller `PinElement` with:
- `background`: line color (`selectedTrip.outboundTransit.line.color ?? '#163d6d'`)
- `borderColor`: `'#ffffff'`
- `glyphColor`: `'#ffffff'`
- Scale down with `element.style.transform = 'scale(0.7)'`

### Polyline implementation

```typescript
// Inside the effect that runs when selectedTrip changes:
const polyline = new google.maps.Polyline({
  path: [
    selectedTrip.outboundTransit.fromStation.location,
    selectedTrip.outboundTransit.toStation.location,
  ],
  geodesic: true,
  strokeColor: selectedTrip.outboundTransit.line.color ?? '#163d6d',
  strokeOpacity: 0.85,
  strokeWeight: 3,
  map: mapRef.current,
})

// Cleanup in the effect's return:
return () => { polyline.setMap(null) }
```

### Updated bounds calculation

When a trip is selected, fit bounds to include all four points:

```typescript
const bounds = new google.maps.LatLngBounds()
bounds.extend(origin)
bounds.extend(selectedTrip.outboundTransit.fromStation.location)
bounds.extend(selectedTrip.outboundTransit.toStation.location)
bounds.extend(selectedTrip.destinationPlace.location)
map.fitBounds(bounds, { padding: 60 })
```

---

## Claude Implementation Guide

### Context files to read first

```
Please read these files:
1. docs/closeish_v2/03-implementation-plan.md  (§6.2 — MapView updates)
2. src/components/MapView.tsx                   (the full file — critical)
3. src/types/trip.ts                            (Trip, TransitLeg)
4. src/types/transit.ts                         (Station)
5. src/App.tsx                                  (how MapView is called, to understand the prop threading)
```

### Prompt to paste

```
We are implementing CLO-009: MapView Updates.

Update src/components/MapView.tsx to show transit corridor for a selected trip.

1. Add a new optional prop: selectedTrip?: Trip | null

2. Add a useEffect that runs when selectedTrip changes:
   - If selectedTrip is provided:
     a. Create two AdvancedMarkerElement station markers (departure + arrival stations)
        Use scaled-down PinElement with line color background (selectedTrip.outboundTransit.line.color ?? '#163d6d')
     b. Create a google.maps.Polyline between the two stations
        strokeColor: line color, strokeWeight: 3, strokeOpacity: 0.85
     c. Fit map bounds to encompass origin + departure station + arrival station + destination place
   - Clean up markers and polyline in the effect's return function
   - If selectedTrip is null/undefined: remove any existing station markers/polyline

3. Do not change any existing props or existing marker behavior.
4. The existing selectedPlace prop and its destination marker are unchanged.

The Google Maps API objects (Polyline, AdvancedMarkerElement, PinElement, LatLngBounds) 
are already loaded — follow the exact patterns used for the existing markers in the file.
```

### Files Claude should produce

| File | Action |
|---|---|
| `src/components/MapView.tsx` | Modify (add selectedTrip prop + station/polyline effects) |
| `src/App.tsx` | Modify (thread selectedTrip prop through to MapView) |
