# Closeish Working Agreements (Codex/Cline)

These are the guardrails Codex should follow when making changes in this repo.

## Workflow
- Explain the intent and planned changes before editing files.
- Use `npm version <x>` (with appropriate semver) to bump versions; let npm update both `package.json` and `package-lock.json`. Do not edit the lockfile manually.
- For each logical unit of work, list the files touched and provide a suggested commit message.
- Keep changes small, reviewable, and aligned to the current phase in `docs/MASTER_PLAN.md`.

## Env & Secrets
- Use `VITE_*` vars only; keep real values out of git. `.env.local` for dev; `.env.example` with placeholders can be committed.
- Geolocation requires HTTPS in prod; localhost is fine in dev. Preserve the map config guard.

## Testing & Safety
- Prefer manual verification notes if no automated tests run; add tests only when scoped per phase.
- Avoid destructive git operations; do not revert unrelated user changes.
