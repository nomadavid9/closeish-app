# Working on Closeish

How work moves from an issue to `main`. Written for a human to follow, and for Claude to follow identically — the process should not change depending on who is at the keyboard.

This is a small project with one maintainer. The practices here are deliberately light: everything that survives is here because it prevents a specific, observed failure, not because it is conventional.

---

## The loop

```bash
# 1. Branch from the issue (not just named after it)
gh issue develop <issue-number> --base main --checkout

# 2. Discuss the approach, then build

# 3. Gates
npm run build && npm run lint

# 4. Commit, with the closing keyword
git commit          # body ends: Closes #<issue-number>

# 5. Open the PR
git push -u origin HEAD
gh pr create --base main

# 6. Read the whole diff on GitHub, then
gh pr merge --squash --delete-branch
```

Everything below is why each step is shaped the way it is.

---

## 1. Start from an issue

Every unit of work has an issue before it has code.

On a team, issues are coordination. Solo, that value is close to zero — and what is left is narrower but more important here: **writing the issue forces you to say what you are about to do before you do it.** This repo was largely vibe-coded, meaning code exists and the reasoning does not. The issue is where the reasoning goes.

Use `gh issue develop`, not `git checkout -b`:

```bash
gh issue develop 42 --base main --checkout
```

This creates the branch, **links it to the issue on GitHub**, and checks it out. The link is the part you cannot get by hand — the issue page then shows the branch and later the PR, so the trail connects end to end. `gh issue develop --list 42` shows what is linked.

If work turns out not to need an issue, it probably did not need doing.

---

## 2. Discuss before building

For anything involving a real design decision, an unfamiliar concept, or code not touched before: talk through what the options are and what they cost **before** writing code. Agreement is signalled explicitly — "let's build it", "go ahead" — and after that, build the agreed thing without reopening the debate.

Skip the discussion for typos, renames, formatting, one-line lookups, and anything explicitly framed as "just do X."

This mirrors the Workspace-level `CLAUDE.md`. It is a default posture, not a gate.

---

## 3. Stay in scope — and say so out loud when you cannot

Do what the issue describes. When the work genuinely cannot be completed inside that boundary, **exceed it deliberately and state why in the commit and the PR.** Silent scope creep is the problem; necessary scope creep is not.

Two real examples from this repo:

- **#39** was types-only, but renaming a shared field forced edits to two consumer files. A half-finished rename is worse than either option, so the rename was completed — and the PR said so, and noted the edits were mechanical.
- **#41** was fixtures-only, but you cannot mock a contract that does not exist, so it defined `TransitDataSource` too. Flagged in the commit body with the reason.

The test: could a reviewer be surprised by something in this diff? If yes, it needs a sentence somewhere.

---

## 4. Verify, do not assert

If a change makes a factual claim — these two points are within the overlap threshold, this ride time crosses the mode cap, this window yields no return — **prove it before claiming it.** A throwaway script bundled with esbuild and run under node is enough:

```bash
npx esbuild scratch/verify.ts --bundle --format=esm --platform=node \
  --outfile=scratch/verify.mjs && node scratch/verify.mjs
```

Keep these out of the repo — scratch directory, not committed — until there is a real test suite (#51) for them to graduate into.

This is not ceremony. The verification pass on #41 caught a station modelled twice under two ids, which would have duplicated the traversal origin and meant no fixture stop ever served more than one line. That bug was already written and about to be committed.

---

## 5. Gates before every commit

```bash
npm run build   # tsc -b && vite build
npm run lint    # eslint .
```

Both must pass. There is no test suite yet; when #51 lands, add it here.

---

## 6. Commit messages

State **what changed and why**, not a file-by-file changelog — the diff already lists the files.

```
Short summary in the imperative, under ~60 chars

What this accomplishes, and the reasoning behind any decision a reader
would otherwise have to reverse-engineer from the code.

- Specific change, and why it is shaped that way
- Another, including anything that exceeded the issue's stated scope

Closes #42
```

**`Closes #42`** in the commit body or PR body auto-closes the issue when the PR merges into `main`. `Fixes` and `Resolves` work the same way. This is what keeps the board self-maintaining rather than something to tidy up later.

When Claude wrote the code, end the message with:

```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

## 7. Pull requests

Open one for every change, even solo. **The value is not approval — it is that you are forced to read the complete diff in one sitting**, in a better viewer than the terminal, before it becomes permanent. For code you did not fully write yourself, that is the highest-leverage habit in this document.

The PR body is where the thinking lives. Cover:

- What the change does, briefly
- **Decisions and their trade-offs** — especially where a plausible alternative was rejected, and why
- Anything beyond the issue's scope
- Verification results, as concrete numbers rather than "tested it"
- `Closes #<n>`

Merge with squash and delete the branch:

```bash
gh pr merge --squash --delete-branch
```

Stale local branches accumulate anyway. `git branch --merged main | grep -v main | xargs git branch -d` clears them.

---

## 8. Update sibling issues as you learn

**The step most likely to be skipped, and the one that compounds.**

Investigating one issue routinely turns up something that belongs to a different one. Write it there, immediately, while the reasoning is fresh. Two real cases:

- Working #39 established that times are `GtfsTime` strings rather than `Date`s, with a past-midnight case that breaks naive implementations. That constraint belongs to **#43**, which builds the time helper — so #43 was updated with the full reasoning before #39 merged.
- Working #41 established that response-mapping tests are worthless until real API responses can be captured. That belongs to **#51** — updated with a capture-first sequence.

**Never leave a dangling reference.** If code or a doc says "see #51", #51 must actually describe the thing by the time the PR opens.

---

## 9. Superseded and stale work

Close it as **not planned**, with a comment saying what replaced it and why. Do not delete issues — deletion is irreversible, wipes cross-references, and loses the record of why a direction was abandoned, which is exactly what a reader six months out needs.

```bash
gh issue close <n> --reason "not planned" --comment "Superseded by … because …"
```

Where the substance survives but the framing is stale, restate it as a new issue and point the old one at its successor rather than closing it silently.

---

## Conventions at a glance

| Thing | Convention |
|---|---|
| Branch name | Whatever `gh issue develop` generates — `42-station-traversal` |
| Base branch | `main` |
| Merge style | Squash, delete branch |
| Labels | `epic` for trackers, `v2` for redesign work |
| Epics | An issue with a task list of its children; children say `Part of #<epic>` |
| Issue closing | `Closes #<n>` in the commit or PR body |
| Secrets | `VITE_*` in `.env.local` only — never committed. See `docs/SETUP.md` |

---

## Notes for Claude

Everything above applies unchanged. Additionally:

- **Read this file at the start of any session involving repo work.** It is not loaded automatically; `CLAUDE.md` points here for that reason.
- Run `gh issue develop`, do not hand-roll the branch — the issue link is the point.
- Check the board (`gh issue list`) before proposing what to work on next. The board is the source of truth for sequencing; the ticket files in `docs/v2/jira_stories/` are the source of truth for detail, and where the two disagree, say so rather than silently picking one.
- Those ticket files still reference `docs/closeish_v2/` and `docs/claude_analysis/`, which no longer exist. Translate to `docs/v2/planning/` and flag the stale path.
- Never merge a PR unless asked. Open it and hand over the link — reading the diff is the maintainer's job.
- Confirm before anything irreversible or outward-facing: deleting issues, force-pushing, rewriting history, or anything that leaves the machine.
