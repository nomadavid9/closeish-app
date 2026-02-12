# Closeish

Closeish is a reverse transit trip finder.

Instead of asking, "How do I get to this place?" Closeish starts with "What places are meaningfully reachable by transit from where I am right now?"

## Why This Matters

In many U.S. metros, trip planning tools are destination-first and car-first.

That creates a daily mismatch:
- people can find places they might like,
- but cannot quickly find places that are truly convenient by transit,
- especially for spontaneous plans, off-peak schedules, and neighborhoods with uneven service.

Closeish is built to invert that flow. We treat transit viability as a first-class signal, not an afterthought.

## Development Setup

### Requirements
- Node.js 18+
- npm

### Environment
Create `.env.local` with:

```bash
VITE_GOOGLE_MAPS_API_KEY=your_maps_key
VITE_GOOGLE_MAP_ID=your_map_id
# Optional; falls back to VITE_GOOGLE_MAPS_API_KEY if omitted
VITE_GOOGLE_PLACES_API_KEY=your_places_key
```

### Run

```bash
npm install
npm run dev
```

### Build

```bash
npm run build
```

### Lint

```bash
npm run lint
```

## Mission

Help people in American, car-dependent cities discover destinations that are actually practical without driving.

## Product Direction

Closeish is currently in active development.

Current focus:
- prove a reliable reverse-search workflow (origin -> candidate places -> rank by "close-ish"),
- keep latency low enough for real-time, mobile-first usage,
- improve scoring quality incrementally with measurable iteration.

## Current Algorithm (Baseline)

This is the current retrieval + ranking baseline and will evolve.

1. Capture origin
- Use browser geolocation to get the user's current coordinates.

2. Pull candidate places
- Query Google Places API v1 `places:searchNearby` using:
- selected category (`restaurant`, `cafe`, `bar`, `park`),
- search radius,
- capped result count.

3. Normalize candidate data
- Map provider fields into internal `Place` objects.
- Estimate walk/transit/drive times from distance heuristics.

4. Rank for "close-ish"
- Apply local scoring logic to prioritize places that balance walkability and transit usefulness.
- Keep only top-K candidates for display.

5. Fail safely
- If live fetch fails or a Places key is missing, fall back to mock data so the app remains usable.

For version history of retrieval behavior, see `docs/PLACES_ALGORITHM_CHANGELOG.md`.

## Best Practices We Follow

- Transit-first product thinking: destination discovery must reflect real transit constraints.
- Incremental algorithm design: each change should be attributable, testable, and documented.
- Graceful degradation: partial outages should not break core user flows.
- Latency discipline: prefer fast approximations first, then targeted enrichment.
- Clear source boundaries: map rendering, place retrieval, and scoring stay modular.
- Transparent evolution: major retrieval changes are logged in `docs/PLACES_ALGORITHM_CHANGELOG.md`.

## Documentation

- Master plan: `docs/MASTER_PLAN.md`
- Release notes: `docs/RELEASE_NOTES.md`
- Contribution workflow: `docs/CONTRIBUTING.md`
- Places algorithm changelog: `docs/PLACES_ALGORITHM_CHANGELOG.md`

## Status

Version: `1.0.0` (active development)

Closeish is not yet a finished transit planner. It is a focused discovery product under active iteration to solve a real gap in transit-first destination finding.
