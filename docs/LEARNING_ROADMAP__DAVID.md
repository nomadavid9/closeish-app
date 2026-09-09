# Closeish — Zero to Hero Learning Roadmap

> This is a living document, not a fixed spec. Phases get fleshed out in detail as we actually work through them together — check things off, rewrite objectives, add phases as reality demands it.

## Starting point

Strong background in ASP.NET, Angular, Ionic, JavaScript, plus the last ~3 years in Python/SQL as an analytics engineer (see `@~/Workspace/PROFILE.md`). React/JSX/hooks and this specific codebase are the new territory — it was vibe-coded, so working code exists but understanding of *why* it works this way doesn't, yet.

## Destination

Be able to read, extend, and debug this codebase independently, and know what has to change to take it from "works for me and a few friends" to holding up under 100+ concurrent users.

## Phases

### 0. Orientation
Objective: know what's actually built vs. in-progress, and how the docs are organized.
Key questions: What does Closeish do, in one sentence? What's the difference between the v1 and v2 approach? Where would I look to find out X?
Read: root `README.md`, `docs/v2/planning/01-current-architecture.md`.

### 1. React & TypeScript fundamentals, via this codebase
Objective: map what you already know (Angular components/services, C# typing) onto React's model (function components, hooks, JSX) using real files in `src/components/` and `src/services/` as examples, not toy tutorials.
Key questions: Why does React re-render, and when? What's the hook equivalent of an Angular service? Why does this app have no DI container?

### 2. Async data & the external API layer
Objective: fully own the pattern used in `src/services/{maps,places,transit}` — `fetch`, `async`/`await`, mapping raw third-party API shapes into this app's own types. `transitland.ts` is today's real example of this.
Key questions: Why does every service function map raw API responses into an internal type instead of using them directly? What happens on an HTTP error in this codebase?

### 3. The domain logic
Objective: understand the actual "closeish" scoring/ranking algorithm (`src/services/scoring/closishScore.ts`) and the transit corridor redesign (`docs/v2/planning/02-transit-redesign-proposal.md`).
Key questions: What makes a place score well? What is the v2 redesign changing about how transit reachability is computed, and why?

### 4. Testing
Objective: there's currently no test suite — pick an approach appropriate for a Vite/React app and add meaningful coverage, starting with the pieces most likely to break silently (scoring logic, API response mapping).
Key questions: What's actually worth testing here? Unit vs. integration boundary for a small SPA like this?

### 5. Production readiness & scaling
Objective: understand what changes between "just me and friends" and "100+ concurrent strangers" — API keys off the client, caching/rate-limiting against Google/Transitland quotas, hosting choice, basic observability.
Key questions: What breaks first under load as this app is built today? What's the minimal backend needed to fix the API-key exposure problem?

### 6. Ongoing feature work
Objective: take a feature from idea to shipped with growing independence, using the discuss-then-build workflow from the Workspace-level `CLAUDE.md`.
