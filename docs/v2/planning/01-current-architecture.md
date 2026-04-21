# Closeish — Current Architecture (Baseline)

> This document captures the state of the Closeish codebase as of the start of the transit-redesign effort. It is the reference point for the changes proposed in `02-transit-redesign-proposal.md`.

## What Closeish Actually Is

The core idea: instead of "how do I get to X?", it asks "what places near me are surprisingly good by transit?" You drop a pin, it finds nearby restaurants/cafes/parks, runs them through a transit quality scorer, and ranks them by how much better they are by transit vs. driving.

**The value prop:** help people in car-dependent cities discover that some destinations are actually great by transit.

## The Tech Stack, Honestly Explained

**Vite is not React.** Vite is a build tool — think of it like the equivalent of `dotnet build` + webpack + `ng serve` combined. It's what compiles and bundles your TypeScript/React code. React is the UI framework.

**React is not Angular.** The biggest mental shift:

- Angular is a full framework (DI, services, routing, forms, HTTP all built-in)
- React is just a UI library — everything else you compose yourself
- No decorators, no modules, no DI container — just functions and hooks

**Your stack at a glance:**

| Layer         | Tool                      | Angular Equivalent          |
| ------------- | ------------------------- | --------------------------- |
| Build         | Vite                      | Angular CLI                 |
| UI Framework  | React 18                  | Angular                     |
| Language      | TypeScript                | TypeScript                  |
| State         | React Hooks (`useState`)  | `BehaviorSubject` / `@Input` |
| Routing       | None yet                  | `RouterModule`              |
| HTTP          | `fetch()` directly        | `HttpClient`                |
| Maps          | `@react-google-maps/api`  | Angular Google Maps         |
| Styling       | Plain CSS                 | SCSS                        |

## The Mental Model: React Hooks vs Angular

This is the biggest gap to close. In Angular you have:

- Component class with `@Component` decorator
- `ngOnInit()` lifecycle hook
- `@Input()`/`@Output()` for data flow
- Services injected via constructor
- RxJS streams for reactivity

In React (specifically this app's style — functional components with hooks):

```
Angular                          React Equivalent
------                           ----------------
@Input() value: string       →   props.value (passed by parent)
@Output() clicked =          →   props.onClicked = () => {} (callback prop)
  new EventEmitter()
private state = 'x'          →   const [state, setState] = useState('x')
ngOnInit() { ... }           →   useEffect(() => { ... }, [])  ← empty deps = run once
ngOnChanges(changes) { ... } →   useEffect(() => { ... }, [dep1, dep2])
get computedValue() { ... }  →   useMemo(() => ..., [dep1, dep2])
this.handleClick =           →   const handleClick = useCallback(() => ..., [deps])
  this.handleClick.bind(this)
#elementRef                  →   const ref = useRef(null)
ChangeDetectionStrategy      →   useMemo + React.memo
  .OnPush
```

## The Codebase Tour: File by File

### Entry Point: `main.tsx`

Ignore this. It's 5 lines that mount React to `<div id="root">`. Equivalent to `platformBrowserDynamic().bootstrapModule(AppModule)`.

### The Brain: `App.tsx`

This file does everything an Angular app would split across an `AppComponent`, a `PlaceService`, a `FilterService`, and a `RouteGuard`. It's big (637 lines) because it's the only stateful layer.

**State variables** (think of each as a `BehaviorSubject`):

```
position          // Browser GPS coordinates (or null)
originOverride    // User-typed search origin (or null)
filters           // All filter state (place type, walk distance, live/mock, etc.)
places            // The raw places array from API
selectedPlaceId   // Which place card is highlighted
loadingPlaces     // Loading spinner flag
placesSource      // Was data from 'mock' or 'live'?
isLoaded          // Has the Google Maps JS library finished loading?
```

**The derived origin** (line ~80):

```ts
const origin = originOverride ?? position
// If user searched for an address, use that. Otherwise use GPS.
```

**The two key effects** (equivalent to `ngOnChanges`):

1. **Map library loading** — fires once on mount, loads Google Maps JS SDK
2. **Places fetching** — fires whenever `origin` or `filters` change:
   - If live mode + API key: calls Google Places API → then enriches with Google Routes API
   - If anything fails: falls back to mock data

**The scoring** (equivalent to a computed `@Input`):

```ts
const scoredPlaces = useMemo(() => {
  return places
    .map(p => ({ place: p, score: scorePlace(p, filters) }))
    .sort(by score descending)
    .slice(0, TOP_K)  // Keep top 8
}, [places, filters])
```

**Two render modes:**

- No origin yet → Landing page (hero, search input)
- Origin set → Main app (filters, map, place cards)

### Components: `MapView.tsx`

Renders the Google Map. The interesting bits:

- Uses `useRef()` to hold the map instance (because Google Maps is imperative — you call methods on it, React doesn't control it declaratively)
- When a place is selected, it calculates a "mirrored bounds" point to center the view between origin and destination symmetrically
- Uses `AdvancedMarkerElement` (Google's modern API) with custom colored pins

**Angular equivalent:** a component wrapping `<google-map>` with `@Input()` for center/zoom and `ViewChild` for the map reference.

### Components: `PlaceAutocomplete.tsx`

A wrapper around Google's `<gmp-place-autocomplete>` web component (not a React component — it's a native custom element from Google).

**Why it needs `useRef()`:** React doesn't know about custom elements, so this component manually creates/attaches/removes the DOM element and listens for its native events (`gmp-select`).

**Angular equivalent:** a wrapper directive around a third-party web component, using `@ViewChild` and `HostListener`.

### Components: `PlaceCard.tsx`

Pure presentational component. Receives a `place` + `closishScore` + `selected` via props, renders a card. Fires `onSelect(placeId)` when clicked.

**Angular equivalent:** a dumb/presentational component with `@Input()` only, no services.

### Services: `googlePlaces.ts`

Calls Google Places API v1 (`places:searchNearby` — a REST endpoint, not the JS SDK). Returns raw places with estimated travel times calculated via Haversine distance formula (straight-line distance → estimated walk/transit/drive minutes).

**Angular equivalent:** an `HttpClient`-based service method that maps the response to your domain type.

### Services: `googleRoutes.ts`

The most complex service. Takes the top 6 places and calls Google Routes API for each (in parallel via `Promise.all`). Parses the step-by-step transit directions to extract:

- Walk before first transit leg (access walk)
- Walk between transit legs (transfer walk)
- Walk after last transit leg (egress walk)
- Wait time, transfer count, total time

**Why only top 6:** Routes API calls cost money. Enriching all 20 would be wasteful.

### Services: `closishScore.ts`

Pure function. Takes a `Place` + `FilterState`, returns a 0–100 score. The scoring rewards:

- Places where transit is significantly faster than driving
- Places with fewer transfers
- Higher-rated places (Google rating)
- Penalizes long walks and long waits

**Two scoring paths:**

- **Baseline:** uses estimated times (fast, works without Routes API)
- **Enriched:** uses actual Routes API data (better accuracy)

## Data Flow (The Whole Picture)

```
User grants geolocation / types an address
         ↓
    App.tsx sets origin
         ↓
    useEffect fires → fetchGoogleNearby()
         ↓ (20 places, estimated travel times)
    enrichPlacesWithTransit() [top 6 only]
         ↓ (adds real transit breakdowns)
    useMemo scores all places → keeps top 8
         ↓
    PlaceCard components render
         ↓
    User clicks a card → selectedPlaceId updates
         ↓
    MapView re-renders with new bounds
```

## The Vite + React = Mobile Strategy

Browser + mobile browser + eventually native iOS/Android are all in scope. The architecture already supports this:

- **Browser:** works now. `npm run build` → static files → any CDN.
- **Mobile browser:** works now. CSS is mobile-first responsive.
- **Native iOS/Android:** the path is **Capacitor** (by Ionic). You wrap your Vite-built `dist/` folder in a native shell. Capacitor gives you access to native APIs (camera, GPS, notifications) while keeping your React code unchanged. Think of it like Cordova but modern and well-maintained.

The key reason Vite is good for this: it produces standard web assets (HTML/JS/CSS) with no server-side dependencies. Capacitor just wraps those assets.

## The One Architectural Thing to Know

**Everything lives in `App.tsx`.** There's no state management library (no Redux, no Zustand, no NgRx equivalent). All state is `useState` hooks in the root component, passed down as props. This is called "prop drilling" and it works fine for a small app like this. If the app grows significantly you'd eventually extract state into a Context or a lightweight store.

The services in `src/services/` are just plain functions (not classes, not injectable). You import them and call them. Simple, but different from Angular's DI pattern.
