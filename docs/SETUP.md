# Local Development Setup

Point your AI assistant at this file if you get stuck on any step — it has full context on this repo and can walk through errors with you.

## 1. Prerequisites

- **Node.js 18+** (this repo was built against Node 22; anything 18+ should work). Check with `node -v`.
- **npm** (ships with Node). Check with `npm -v`.
- A **Google Cloud** account with billing enabled — the free tier covers this project's usage, but Google requires a billing account on file to issue API keys for Maps/Places/Routes.
- A **Transitland** account (free) — used for transit-stop data as of the in-progress v2 redesign.

If you don't have Node installed, get it from [nodejs.org](https://nodejs.org) or via a version manager (`nvm`, `fnm`, etc.) if you'll be juggling multiple Node projects later.

## 2. Clone and install

```bash
git clone <repo-url>
cd closeish-app
npm install
```

This pulls down everything in `package.json` — React, Vite, TypeScript, the Google Maps JS loader, ESLint. No global installs needed.

## 3. API keys

This app has **no backend** — it calls Google Maps/Places/Routes and Transitland directly from the browser, so API keys live only in a local env file that is never committed (`.env.local` is in `.gitignore`).

### These keys do not live in the repo, and never will

Two separate reasons, both hard rules, not style preferences:

1. **They're secrets, and this is a client-side app.** Because there's no backend, whatever key ends up in `.env.local` gets baked into the built JS bundle and is technically visible to anyone using the deployed app (see the "known gaps" note in the root `CLAUDE.md`). Keeping them *out of the repo* is the one layer of protection that's actually within our control — the alternative is a key visible to literally anyone who clones the repo, forever.
2. **Git history is permanent.** Committing a key once and deleting it in a later commit does not remove it — it's still sitting in the git history/reflog and recoverable by anyone with a clone, including if this repo is ever made public, forked, or backed up somewhere unexpected. There's no "undo" for a committed secret short of rewriting history and rotating the key, which is exactly the situation this rule exists to avoid.

Because of this, **don't provision your own keys** by signing up for Google Cloud/Transitland accounts yourself, even though it's possible to (see the reference section below). Keys for this project come from the repo owner, who holds the actual Google Cloud billing account and Transitland registration and needs to be able to see what's using quota and revoke access if needed.

### How you'll actually get your keys

1. Ask the repo owner for the current `.env.local` values.
2. They'll send them to you over Discord DM (not posted in a shared/public channel).
3. Paste them directly into your local `.env.local` — never into a commit, a PR description, a screenshot, or any other file that could end up tracked or shared.
4. Once the app is running locally and you've confirmed the keys work, **delete the Discord message** (on both ends, if the other person hasn't already) so it's not sitting in chat history indefinitely.

Discord is a convenience channel for a two-person project, not a secrets manager — treat it as a one-time delivery mechanism, not a place these keys should persist. If a key ever needs to be shared again (rotated, new teammate, etc.), repeat this same request → deliver → delete flow rather than digging up an old message.

Create `.env.local` in the repo root with the values you're given:

```bash
VITE_GOOGLE_MAPS_API_KEY=your_maps_key
VITE_GOOGLE_MAP_ID=your_map_id

# Optional — falls back to VITE_GOOGLE_MAPS_API_KEY if omitted
VITE_GOOGLE_PLACES_API_KEY=your_places_key
# Optional — enables real transit-step enrichment (walk/wait/transfer detail) for top candidates
VITE_GOOGLE_ROUTES_API_KEY=your_routes_key

# Transit stop data (v2 redesign)
VITE_TRANSITLAND_API_KEY=your_transitland_key
```

Any var prefixed `VITE_` gets baked into the client bundle by Vite at build time — that's how the browser code can read `import.meta.env.VITE_GOOGLE_MAPS_API_KEY`.

### Reference only: how these keys are provisioned

You shouldn't need to do this yourself — it's here so it's documented somewhere, and in case the repo owner is walking you through creating a *new* key (e.g. a new API gets added later).

**Google Maps API key + Map ID:**
1. [Google Cloud Console](https://console.cloud.google.com/) → create/select a project.
2. Enable these APIs under "APIs & Services → Library": **Maps JavaScript API**, **Places API (New)**, **Routes API**.
3. "APIs & Services → Credentials" → create an API key. Restrict it (by HTTP referrer) before anything goes to production.
4. "Google Maps Platform → Map Management" → create a Map ID for `VITE_GOOGLE_MAP_ID` (needed for `AdvancedMarkerElement`-style custom pins — a plain API key isn't enough).
5. `VITE_GOOGLE_PLACES_API_KEY` / `VITE_GOOGLE_ROUTES_API_KEY` are optional — one key covers all three APIs as long as they're all enabled on it. Split them out only for separate quota/billing tracking per API.

**Transitland API key:**
1. [transit.land](https://www.transit.land/) → register for a free account/API key.
2. Free tier: 10,000 REST calls/month, non-commercial use, requires visible attribution in the app UI (already wired up — see `CLO-008-app-wiring.md` under `docs/v2/jira_stories/`).
3. Check [transit.land/map](https://www.transit.land/map) to confirm an area has coverage before assuming a "no results" bug is actually a bug.

## 4. Run it

```bash
npm run dev
```

Vite starts a local dev server (default `http://localhost:5173`) with hot module reload — save a file, the browser updates without a full refresh.

## 5. Verify it works

- Open the dev server URL, grant location access (or type an address into the search box).
- You should see nearby places on the map, ranked by "closeish" score.
- If you skipped the Google keys, the app falls back to mock data automatically rather than crashing — check the browser console for which mode it's in.

## 6. Other useful commands

```bash
npm run build     # tsc type-check + production build to dist/
npm run lint       # ESLint
npm run preview    # serve the production build locally
```

There is currently no test suite (`npm test` doesn't exist yet) — see the "known gaps" section of the root `CLAUDE.md`.

## Troubleshooting

- **Blank map / console errors about `AdvancedMarkerElement`:** almost always a missing or wrong `VITE_GOOGLE_MAP_ID` — the map renders but custom pins fail silently without it.
- **Map loads but no places show up:** check whether Places API (New) is actually enabled on your Google Cloud project, not just the classic Places API — they're billed and gated separately.
- **Env changes not taking effect:** restart `npm run dev` — Vite only reads `.env.local` at server start, not on hot reload.
- **Still stuck:** paste the error into your AI assistant along with this file and `docs/v2/planning/01-current-architecture.md` for context.
