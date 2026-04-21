# Closeish — Transit Redesign Proposal

> **Purpose:** this document proposes a substantial redesign of Closeish from a "nearby places ranked by transit quality" discovery tool into a **single-transit-leg round-trip planner**. It is intended as a handoff to Claude Code for implementation planning. Some sections are marked as open design questions where input/exploration is explicitly wanted before implementation.
>
> **Companion document:** `01-current-architecture.md` describes the codebase as it stands today.

---

## 1. The Paradigm Shift

### What the app does today

The user drops a pin, the app queries Google Places for ~20 nearby places in a radius around that pin, scores each by transit quality, and shows the top 8.

### What the app should do instead

The user drops a pin, and the app returns **complete, feasible round-trip day plans** built around a single leg of public transit. Each plan is:

```
walk  →  transit (one leg, no transfers)  →  walk
          ↓
       activity / dwell window at destination
          ↓
walk  ←  transit (one leg, no transfers)  ←  walk
```

**Motivation for the shift.** The current model has two weaknesses:
1. **It's radius-bound.** A pure nearby-radius search can't recommend a place 12 miles away that happens to be a 20-minute commuter-rail ride — exactly the kind of trip that makes transit shine.
2. **It doesn't guarantee the user can get home.** "This place scores well by transit" is not the same as "there's a realistic return trip before the last bus runs."

The redesigned app solves both by **keying discovery off transit stations rather than off a geographic radius**, and by **validating the full round trip** before presenting a place as an option.

---

## 2. Core Design Principles

These are load-bearing rules that all other design decisions should respect.

1. **One transit leg, no transfers.** Every trip is walk → single vehicle → walk → activity → walk → single vehicle → walk. Transfers add complexity, failure modes, and anxiety, and they undercut the "easy" promise of the app.
2. **Round trips, not one-way trips.** A place is only a valid recommendation if a return trip exists inside the user's time window. If the return doesn't work, the place is shown but clearly labeled as infeasible with the reason why.
3. **Mode-aware tolerance.** A 60-minute ride on a commuter train is reasonable; a 60-minute ride on a city bus usually isn't. The app has to know the difference.
4. **Daylight-aware by default.** Default behavior is that the user is back home no later than 30 minutes after sunset. This is an accessibility choice (see §7).
5. **Show eliminated options, don't hide them.** When a place is filtered out by time window, sunset, mode preference, etc., the user sees it with a clear label explaining why. This teaches the user what their settings are doing and lets them adjust intentionally.

---

## 3. The Target User Experience

Walking through a concrete example (David's own scenario):

> I leave my apartment. 5-minute walk to a commuter rail station. 25-minute train ride. Walk off the train into a set of trails. Walk those trails for ~3 hours. Walk back to the same station. Train back. Walk home.

The app should surface this as a single trip card with all legs visible:

| Leg                            | Detail                          |
| ------------------------------ | ------------------------------- |
| Walk                           | origin → departure station      |
| Transit                        | departure station → arrival station |
| Dwell window at destination    | user-adjustable, default 3 hours |
| Walk                           | arrival station → departure station (return) |
| Transit                        | arrival station → origin station |
| Walk                           | arrival station → origin        |

Per trip, the user should see:

- A **summary** (total time door-to-door, mode, distance, one-line description)
- The **specific return trip** that was used to validate feasibility, including how late the last return runs
- A **link out** to Google reviews / place details for the destination
- An **easy way to cycle between candidate trips** without losing state

---

## 4. Architectural Changes

### 4.1 Replace radius-based place search with station-keyed place search

**What changes.** Rather than one Google Places call around the origin, the app makes many Places calls — one per *candidate transit station* reachable via a single line from the user's origin.

**Why.** This is what makes a 15-mile commuter-rail destination discoverable at all. Discovery follows the transit graph, not a geographic blob.

### 4.2 Integrate Transitland for station and line data

**What changes.** Add Transitland as the source of truth for:
- Which transit stations are near the user (within the user's walk-distance setting)
- Which lines serve each station
- The ordered sequence of stations along each line, in each direction
- Schedule data needed to validate the return leg (last departure, headways)

**Why.** Google Places doesn't expose transit graph structure. Google Routes gives us point-to-point directions but not "what are all the stations along the Orange County Line." Transitland does.

### 4.3 Traverse the transit graph from the origin

Once we know which lines pass through which stations near the origin, the app walks outward along each line, in each direction, collecting candidate destination stations. At each candidate station, Places is queried for nearby activities.

**The core algorithm, shape of it:**

```
1. Find all stations within walk_distance of origin  (Transitland)
2. For each of those "origin stations":
     For each line serving that station:
       For each direction (e.g. northbound, southbound):
         Walk the line outward station-by-station
         At each station, decide: stop, or query Places here and continue?
         At each queried station, fetch places → validate return trip → score
3. Aggregate and rank across all branches
```

**This is a bounded traversal, not a full BFS of the region.** The bound is per-line, directional, and mode-aware. See §5 for the open design questions about exactly how to bound it.

### 4.4 Round-trip feasibility gate

Before a place is shown as a valid recommendation, the app must confirm:

- There is a return transit trip from the destination station back toward the origin station
- That return departs late enough to cover the user's chosen dwell window
- The user arrives home before their daylight cutoff (if enabled)

If any of these fail, the place still renders but is visibly labeled (e.g. "no return available in your window", "would miss last bus", "would arrive home after sunset").

### 4.5 Replace the current single `scorePlace` with a trip-level score

Today the score is per-place. In the new model the unit of recommendation is a *trip* (walk + transit + dwell + transit + walk, anchored at a destination place). Scoring has to operate on the whole trip so that things like "return trip is too tight" or "walk from station is 18 minutes" can penalize appropriately.

**Preserving the idea behind `closishScore`:** the existing rewards (transit-beats-driving, higher-rated places, penalty for long walks and waits) remain relevant — they just apply to a richer object.

---

## 5. Open Design Questions

These are the questions that need discussion/prototyping before committing to code. Claude Code should treat these as the places where its judgment is explicitly invited.

### 5.1 How do we bound station traversal along a line?

**The tension.** A pure radius cap (e.g. "no station further than 10 miles") defeats the whole point — a commuter rail ride to a station 20 miles away can be faster than a 3-mile bus ride. But unbounded traversal is wasteful and will make terrible recommendations.

**Candidate heuristics (not yet decided):**
- **Ride-time cap per mode.** E.g. up to 45 min for commuter rail, 30 min for light rail, 25 min for bus, 20 min for trolley.
- **Station-to-station "worthwhileness" score.** Each successive station on a line gets a score reflecting (distance added vs. previous station) / (expected travel time added). In dense urban areas, close stations earn a keep-going signal because walk-to-next would be too far. In sparse suburban areas, widely-spaced stations bleed depth fast.
- **Overlap detection.** If the nearby-places halo of station N+1 overlaps heavily with station N's, skip the Places call — we've already captured that neighborhood.

**What's needed:** a small design doc or prototype comparing these heuristics on one or two real lines near the user (e.g. Metrolink Orange County, North County Transit District bus + Coaster).

### 5.2 Data structures for lines, stations, and directions

What does the in-memory representation look like? Candidates to discuss:
- A `TransitLine` object with an ordered array of stations per direction
- A graph with stations as nodes and lines-through-stations as edges
- A flat `StationVisit` list produced by the traversal, each tagged with its parent line, direction, and hops from origin

The right answer probably depends on how we end up bounding traversal (§5.1).

### 5.3 Mode-specific ride tolerance — user-exposed or internal?

Two options:
- **Internal defaults** baked into the scorer, invisible to the user.
- **User-exposed sliders per mode** ("max bus ride: 25 min", "max train ride: 60 min").

Probably start internal, expose later if needed. But worth confirming.

### 5.4 How do we represent "a trip" as a data shape?

A trip is now a composite: origin, departure station, line/direction, arrival station, destination place, dwell window, return plan. Need a `Trip` type that the whole app (scorer, card, map, feasibility gate) can speak in terms of. This should probably land in `src/types/` alongside `places.ts` and `filters.ts`.

---

## 6. New User Controls

All default-on, all overridable. Consistent with today's filter model.

| Control                   | Default         | Purpose                                         |
| ------------------------- | --------------- | ----------------------------------------------- |
| Walk distance to station  | 10 min          | How far the user is willing to walk to their departure station from origin. |
| Dwell window              | 3 hours         | Time spent at destination. Directly gates which return trips are feasible. |
| Mode preference           | All             | `train` / `bus` / `all`. Filters which lines get traversed at all. |
| Daylight cutoff           | 30 min post-sunset | Must be home by this time (see §7). |

**Dwell window behavior.** The slider is two-way reactive: widening it filters *out* destinations whose last return runs earlier; narrowing it reveals destinations that were previously excluded because the user had too much time to kill.

---

## 7. Daylight-Aware Planning (Accessibility)

**Motivation.** Many users — and, in practice, disproportionately women — do not feel safe walking to/from transit or riding transit after dark. Ignoring this makes the app's recommendations unusable for them. Treating it as a first-class, default-on constraint is a positive, proactive choice.

**Default behavior.** The user is home no later than 30 minutes after local sunset on the day of the trip.

**User override.** A single control lets the user move this cutoff earlier or later:
- Earlier: "I want to be home `N` hours before sunset"
- Later: "I'm comfortable walking `N` hours after sunset"

**Presentation.** Trips that would violate the user's daylight setting are shown but labeled (consistent with §2, principle 5), so the user can see what they're filtering out and make an informed adjustment.

---

## 8. UX Details

- **Trip card** should show all legs (walk, transit, dwell, transit, walk) with times, plus a prominent "last return: HH:MM" line so the user knows what's gating feasibility.
- **Activities at destination** are a soft/amorphous feature. For v1, it's acceptable to show the destination place and let the dwell window be a single block. Future iterations can suggest activity sequences that fill the window (e.g. "walk the bay (30 min) → lunch (1 hr) → coffee (30 min)") — but this is explicitly *not* blocking.
- **Eliminated trips** appear in the list with a muted style and a single-line reason tag ("missed last return", "after sunset cutoff", "bus ride exceeds preference").
- **Trip navigation** should let the user flip through candidate trips without resetting the map or losing which trip they were on.

---

## 9. Out of Scope for This Pass

Explicitly deferred to keep the redesign tractable:

- **Multi-leg / transfer trips.** Single-leg-only is a design commitment for v1 (§2).
- **Park-and-ride.** Driving to a commuter rail station (and optionally integrating SpotHero for paid parking) is an interesting future direction but is not part of this redesign.
- **Native iOS/Android.** Capacitor wrap remains the planned path, but the redesign happens first on web.
- **Activity-sequence suggestions inside the dwell window.** See §8.

---

## 10. Suggested Next Steps

1. **Prototype the line-traversal bounding heuristic** (§5.1) against one real line near the user before committing to an algorithm.
2. **Define the `Trip` type** (§5.4) and let it drive the scorer and component refactor.
3. **Wire Transitland** as a new service under `src/services/transit/`, parallel to the existing `googleRoutes.ts`.
4. **Introduce a round-trip feasibility gate** before any place is scored.
5. **Add the daylight cutoff** as a first-class filter, not a late addition.
