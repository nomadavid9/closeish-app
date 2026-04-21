# CLO-007 — TripCard Component

| Field | Value |
|---|---|
| **Status** | To Do |
| **Type** | Feature |
| **Phase** | 7 of 10 |
| **Depends on** | CLO-001 |
| **Blocks** | CLO-008 |

---

## Summary

Create `src/components/TripCard.tsx` — the v2 replacement for `PlaceCard.tsx`. A trip card displays the full round-trip (all legs with times), the destination place, and feasibility status. Infeasible trips render in a muted style with a single-line reason label. `PlaceCard.tsx` is not deleted in this story.

---

## Background

In v1, each card shows a destination place with estimated transit metrics. In v2, each card shows a *trip* — walk + transit + dwell + transit + walk — anchored to a destination place. The card must communicate both the outbound journey and the fact that a return trip has been validated (or explain why it hasn't).

The design follows the existing card visual style from `App.css` but extends it with leg-breakdown rows, a return summary line, and muted/eliminated styling.

See: `docs/closeish_v2/02-transit-redesign-proposal.md` §3 (Target UX), §8 (UX Details).  
See: `docs/closeish_v2/03-implementation-plan.md` §6.1 (TripCard).

---

## Acceptance Criteria

- [ ] `src/components/TripCard.tsx` is created and exports a default `TripCard` component
- [ ] Props: `{ trip: Trip; selected: boolean; onSelect: (tripId: string) => void }`
- [ ] **Feasible trip card displays:**
  - Total door-to-door time (prominent, top of card)
  - Outbound leg summary: `"5m walk → 25m train → 8m walk"` in a single line
  - Destination place name and category
  - Place rating (if available)
  - Dwell window: `"3h at destination"`
  - Return summary: `"Last return: 6:42 PM (4 more options)"`
  - Transit mode badge with line color (background from `trip.outboundTransit.line.color`, default navy if null)
- [ ] **Infeasible trip card displays:**
  - Muted/dimmed styling (CSS class `trip-card--infeasible`)
  - Destination place name only
  - Reason tag: `trip.feasibility.reason`
- [ ] Selected state uses a distinct style (left border accent, same pattern as v1 `PlaceCard`)
- [ ] Card is keyboard accessible: `role="button"`, `tabIndex={0}`, `onKeyDown` handles Enter/Space
- [ ] Proper ARIA labels for screen readers
- [ ] No new CSS file — add new card styles to `App.css`
- [ ] The component does not import from `closishScore.ts` or `PlaceCard.tsx`
- [ ] `npm run build` passes

---

## Technical Notes

### Total door-to-door time

```typescript
const totalMinutes =
  trip.walkToStation.estimatedMinutes +
  trip.outboundTransit.estimatedRideMinutes +
  trip.walkToPlace.estimatedMinutes +
  trip.dwell.requestedMinutes +
  trip.walkToReturnStation.estimatedMinutes +
  trip.returnTransit.estimatedRideMinutes +
  trip.walkHome.estimatedMinutes

// Format: "4h 25m" or "55m"
```

### Leg summary line format

```
"5m walk → 25m train → 8m walk"
```

Map `TransitMode` to label: `commuter_rail` → `"train"`, `subway` → `"subway"`, `light_rail` → `"tram"`, `bus` → `"bus"`, `ferry` → `"ferry"`, `cable_car` → `"cable car"`.

### Return summary

```typescript
const lastReturn = trip.dwell.latestReturn   // "18:42:00"
const formatted = formatTime(lastReturn)      // "6:42 PM"
const extraCount = trip.dwell.returnCount - 1
const returnLabel = extraCount > 0
  ? `Last return: ${formatted} (${extraCount} more)`
  : `Last return: ${formatted}`
```

### CSS classes to add to App.css

```css
.trip-card { ... }
.trip-card--selected { ... }
.trip-card--infeasible { opacity: 0.55; }
.trip-card__legs { ... }        /* leg breakdown line */
.trip-card__return { ... }      /* return summary line */
.trip-card__reason-tag { ... }  /* infeasible reason label */
.trip-card__mode-badge { ... }  /* colored mode pill */
```

Follow existing naming conventions in `App.css` (kebab-case BEM-ish, no nesting).

---

## Claude Implementation Guide

### Context files to read first

```
Please read these files:
1. docs/closeish_v2/02-transit-redesign-proposal.md  (§3 and §8 — UX)
2. docs/closeish_v2/03-implementation-plan.md        (§6.1 — TripCard)
3. src/types/trip.ts
4. src/types/transit.ts
5. src/components/PlaceCard.tsx    (existing — follow the same patterns for props and accessibility)
6. src/App.css                     (understand existing class naming conventions before adding new ones)
```

### Prompt to paste

```
We are implementing CLO-007: TripCard Component.

Create src/components/TripCard.tsx.

Props: { trip: Trip; selected: boolean; onSelect: (tripId: string) => void }

Feasible trip shows:
- Total door-to-door time (walk + transit + dwell + transit + walk) — formatted as "Xh Ym" or "Ym"
- Outbound leg summary line: "5m walk → 25m train → 8m walk"
  (map TransitMode to human label: commuter_rail→train, subway→subway, light_rail→tram, bus→bus, ferry→ferry, cable_car→cable car)
- Destination place name and category
- Place rating if available
- Dwell: "3h at destination"
- Return: "Last return: 6:42 PM (4 more options)" or "Last return: 6:42 PM" if only one
- Mode badge colored with trip.outboundTransit.line.color (default to navy #163d6d)

Infeasible trip shows:
- Muted styling (opacity 0.55)
- Destination place name
- Reason tag: trip.feasibility.reason

Follow the same accessibility patterns as PlaceCard.tsx (role, tabIndex, keyboard handler).

Add required CSS classes to App.css following the existing naming conventions.
Do not delete PlaceCard.tsx.
Do not modify any service files.
```

### Files Claude should produce

| File | Action |
|---|---|
| `src/components/TripCard.tsx` | Create |
| `src/App.css` | Modify (add new card classes) |
