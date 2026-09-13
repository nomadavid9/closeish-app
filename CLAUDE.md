# Closeish

A "reverse transit trip finder": instead of "how do I get to X," it asks "what's meaningfully reachable by transit from here." Targets car-dependent US metros. React 18 + Vite + TypeScript SPA — no backend yet, calls Google Maps/Places/Routes (and, as of the in-progress v2 redesign, Transitland/GTFS) directly from the client.

See `@PROFILE.md` (Workspace level) for who's working on this and how to pitch explanations, and `docs/LEARNING_ROADMAP__DAVID.md` for the current learning phase and what to reinforce as we go.

## How work gets done here

**Read `.github/CONTRIBUTING.md` before starting any repo work.** It defines the issue → branch → PR → merge loop that both humans and Claude follow, and it is not loaded into context automatically.

The short version: every change starts from a GitHub issue; branches are cut with `gh issue develop` so they link to the issue; `npm run build` and `npm run lint` both pass before any commit; commits carry `Closes #<n>`; PRs get opened but never merged by Claude. Scope overruns are allowed but must be stated. Findings that belong to a different issue get written to that issue immediately.

## Docs layout

- `docs/SETUP.md` — local dev environment setup (Node, API keys, running the app). Point new contributors here first.
- `docs/START_HERE.md` — new-developer onboarding doc, pitched at a C#/ASP.NET MVC background. Read after `SETUP.md`.
- `docs/v1/` — original planning docs, flat files, SCREAMING_SNAKE names (`MASTER_PLAN.md`, `CONTRIBUTING.md`, etc). Superseded — `docs/v1/CONTRIBUTING.md` in particular was written for Codex/Cline and is replaced by `.github/CONTRIBUTING.md`.
- `docs/v2/planning/` — numbered narrative docs for the current transit redesign (`01-current-architecture.md` is the best orientation read; start there).
- `docs/v2/jira_stories/` — one file per ticket, driving the redesign implementation.
- **Root `README.md`'s doc links are stale** — they point at `docs/MASTER_PLAN.md` etc. from before the `docs/v1`/`docs/v2` reorg. Don't trust those paths; use the layout above.

## Known gaps worth surfacing as they become relevant

- No test suite exists yet.
- No backend — API keys currently live client-side (`.env.local` / `VITE_*` vars). Fine for a handful of friends-and-family users; will need to move server-side (plus caching/rate-limiting) before this could hold up under real concurrent load.
