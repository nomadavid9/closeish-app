# Start Here — New Developer Guide

Welcome. This doc bridges what you already know (C#/ASP.NET MVC) to what this codebase actually is, so you can get oriented fast without a React tutorial detour. It's written to also be handed to an AI assistant — paste this file in along with whatever you're confused about and it has enough context to help.

First, do the setup in [`docs/SETUP.md`](./SETUP.md) so you have a running app to poke at while you read this.

## What this app does, in one sentence

You drop a pin (or type an address), and Closeish shows you nearby places ranked by how good they are to reach *by transit*, not by driving — the inverse of a normal "get directions to X" tool.

## The stack, mapped to what you know

| ASP.NET MVC world | This app | Why the shape differs |
|---|---|---|
| `dotnet build` / MSBuild | **Vite** | Bundles/transpiles TS+JSX into JS the browser can run, plus a dev server with hot reload. Think build tool, not framework. |
| ASP.NET MVC (Controllers, Views, Model binding, DI container, routing) | **React** | React is *just* the view layer — there's no framework-provided DI, routing, or controller layer. You compose those yourself (or don't, if the app doesn't need them yet — this one mostly doesn't). |
| C# | **TypeScript** | Same job: static types over a dynamic language (JS instead of IL). |
| Razor view (`.cshtml`) | **JSX** (`.tsx` file) | Markup + code in one file, but it's a real function returning UI, not a templating language with directives. |
| `ViewModel` passed from Controller to View | **Props** passed from parent component to child component | One-way data flow down the tree — no model binding round trip. |
| Instance field on a Controller / private state | **`useState`** hook | `const [state, setState] = useState(initial)` — `state` is the current value, `setState` triggers a re-render with the new one. |
| `OnActionExecuting` / constructor logic that runs on each request | **`useEffect`** | Runs side effects (fetch calls, subscriptions) in response to a component rendering or its inputs changing. Empty dependency array = runs once, like startup logic. |
| Injected service (`IPlaceService` via constructor) | **Plain imported function** | Services in `src/services/` aren't classes or injectable — you `import { fetchGoogleNearby } from '...'` and call it directly. No container. |
| `HttpClient` | **`fetch()`** | Same job, browser-native, no wrapper library in this codebase. |
| `appsettings.json` / `IConfiguration` | **`.env.local`** + `import.meta.env.VITE_*` | Env vars, but baked into the client bundle at build time since there's no server to hold secrets. Never committed — see "no backend" below and [`docs/SETUP.md`](./SETUP.md#3-api-keys) for how you actually get these keys from the repo owner. |
| `Program.cs` / `Startup.cs` | **`main.tsx`** | Bootstraps the app. Genuinely 5 lines — mounts React to a `<div id="root">`. Not worth dwelling on. |

The one thing with no MVC equivalent at all: **there is no server**. This is a pure static SPA — no Controllers, no server-side routing, no backend process. Every API call (Google Maps, Places, Routes, Transitland) fires directly from the user's browser. That's deliberate for now (see "known gaps" below) but it's the single biggest architectural difference from anything ASP.NET MVC trained you to expect.

## Where things live

```
src/
  App.tsx              # The "everything" file — all app state lives here (see below)
  components/          # Presentational pieces: MapView, PlaceAutocomplete, PlaceCard
  services/
    maps/              # Google Maps JS SDK loading
    places/            # Google Places API calls + mock data fallback
    transit/           # Google Routes API + Transitland API calls
    scoring/           # The "closeish" ranking algorithm — pure function, no I/O
  types/               # Shared TypeScript types (Place, Filters, etc.)
```

**`App.tsx` is the one file that matters most starting out.** There's no state management library (no Redux/NgRx equivalent) — every piece of app state is a `useState` hook in this one root component, passed down to children as props. In MVC terms, imagine one Controller action that owns every piece of state for the whole page and passes pieces of it into partial views. That's unusual for a "real" app, but it's a reasonable choice at this size — don't read it as a mistake to fix on day one.

Everything else — `components/`, `services/` — is a plain function that either renders UI or does one job (call an API, score a place) and returns a value. No classes, no interfaces-as-contracts pattern like C# uses; TypeScript's structural typing means a shape either matches or it doesn't, no explicit `implements` needed.

## How a request actually flows

1. User grants location (or types an address) → `App.tsx` sets `origin`.
2. A `useEffect` watching `origin`/`filters` fires → calls `services/places/googlePlaces.ts` → gets ~20 nearby places back with *estimated* travel times (straight-line distance heuristics, not real transit data).
3. Top 6 candidates get enriched with real transit step data via `services/transit/googleRoutes.ts` (capped at 6 because Routes API calls cost money).
4. `services/scoring/closishScore.ts` — a pure function, easiest file in the repo to unit test if you're looking for a first testing target — scores and ranks everything.
5. Top 8 scored places render as `PlaceCard`s; the map re-centers around whichever one is selected.
6. If any live call fails, or a key is missing, the app silently falls back to mock data rather than breaking — check the browser console to see which mode you're in.

## Known gaps — don't be surprised by these

- **No test suite yet.** If you're used to a test project alongside every MVC project, that discipline doesn't exist here yet — an early good contribution.
- **No backend, so API keys are client-visible.** Fine for friends-and-family scale; will need to move server-side before this holds up under real concurrent load. See `docs/v2/planning/03-implementation-plan.md` for what a backend split would need to cover (rate limiting, caching, quota protection).
- **In-progress redesign (v2):** the app is mid-migration from distance-heuristic transit estimates to real GTFS/Transitland stop data. `docs/v2/planning/01-current-architecture.md` and `02-transit-redesign-proposal.md` cover the "why"; `docs/v2/jira_stories/` has the ticket-by-ticket breakdown of what's landed vs. pending.

## Where to go next

- [`docs/v2/planning/01-current-architecture.md`](./v2/planning/01-current-architecture.md) — a deeper file-by-file tour of the same codebase (written with an Angular comparison lens rather than MVC — still useful once the ideas above click).
- [`docs/v2/planning/02-transit-redesign-proposal.md`](./v2/planning/02-transit-redesign-proposal.md) — what's actively changing and why.
- [`docs/v2/jira_stories/`](./v2/jira_stories/) — one file per ticket; this is where day-to-day implementation work is tracked.
- Root [`CLAUDE.md`](../CLAUDE.md) — the doc layout map and known-gaps summary, kept short on purpose.

When something doesn't make sense, the fastest path is usually: skim the relevant file in `src/`, then ask your AI assistant with this file and the specific file open — you have enough shared context at that point for a real answer instead of a generic React tutorial.
