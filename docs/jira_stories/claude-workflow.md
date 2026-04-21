# Implementing Closeish v2 with Claude Code

> **Purpose:** A repeatable workflow for using Claude Code to implement each Jira story in the v2 redesign. Read this before starting any story. Each story file in `docs/jira_stories/` has a "Claude Implementation Guide" section that plugs into this workflow.

---

## The Core Idea

Each story is a self-contained unit of work. Claude Code is the implementation partner. The workflow has three steps:

1. **Orient Claude** — give it the context it needs before asking for any code
2. **Implement** — paste the story's Claude prompt; let it work
3. **Review** — verify the output against the acceptance criteria

Do not skip step 1. Claude starts each session cold with no memory of previous sessions. If you don't orient it, it will make decisions that conflict with the architecture.

---

## Step 1 — Orienting Claude (do this at the start of every session)

Paste this into the Claude Code chat at the start of a new session:

```
Please read these files before we start, in this order:
1. docs/claude_analysis/codebase-overview.md
2. docs/closeish_v2/03-implementation-plan.md

Once you've read them, confirm you understand the current v1 architecture 
and the v2 redesign plan. Then we'll work on a specific story.
```

Wait for Claude to confirm. It will summarize what it understood — this is your signal that it has the right mental model.

---

## Step 2 — Implementing a Story

Each story in `docs/jira_stories/` has a section called **"Claude Implementation Guide"** with:

- A list of additional files Claude should read
- A ready-to-paste prompt
- A list of files Claude should produce

**Paste the prompt exactly.** It is written to give Claude the right scope — not too broad (it won't over-engineer), not too narrow (it won't miss important constraints).

**Expect Claude to:**
- Read the files listed before writing any code
- Ask clarifying questions if something is genuinely ambiguous
- Write code that compiles (`npm run build` should pass)
- Not add features beyond the story scope

---

## Step 3 — Reviewing Claude's Output

After Claude finishes, verify against the story's **Acceptance Criteria** checklist.

Then run:

```bash
npm run build    # TypeScript must compile cleanly
npm run lint     # No new lint errors
```

If either fails, paste the error output back to Claude with:

```
This failed. Please fix it without changing anything outside the files 
you just modified.
```

---

## Common Pitfalls

**Don't combine stories.** Each story is sized to be independently testable. Combining them makes review harder and errors harder to isolate.

**Don't let Claude refactor what it didn't touch.** If Claude starts "cleaning up" unrelated code, interrupt it:

```
Please only modify files that are in scope for this story. 
Don't change [filename] — that's out of scope.
```

**Do give Claude the error output, not a description of it.** Paste the full TypeScript/ESLint error text. Descriptions introduce ambiguity.

**Do tell Claude when the build passes.** It helps Claude confirm its changes were complete. A simple "Build passes" is enough.

---

## Session Continuity

If you close Claude Code and come back to a half-finished story:

1. Start with the orientation step (§1 above)
2. Tell Claude which story you were on and what was done:
   ```
   We were working on CLO-003. The following files were already created: 
   [list them]. We stopped before implementing [X]. Please continue.
   ```
3. Claude will read the current state of those files and pick up from there.

---

## Story Sequence

Stories must be implemented in order. Each phase depends on types and services from the previous phase.

| Story | Title | Depends on |
|---|---|---|
| CLO-001 | Types Foundation | — |
| CLO-002 | Transitland Service | CLO-001 |
| CLO-003 | Trip Builder — Station Traversal Stub | CLO-001, CLO-002 |
| CLO-004 | Feasibility Gate | CLO-001 |
| CLO-005 | Full Trip Builder | CLO-002, CLO-003, CLO-004 |
| CLO-006 | Trip Scorer | CLO-001 |
| CLO-007 | TripCard Component | CLO-001 |
| CLO-008 | App.tsx Wiring | CLO-001 through CLO-007 |
| CLO-009 | MapView Updates | CLO-008 |
| CLO-010 | v1 Cleanup | CLO-008, CLO-009 |

---

## Marking a Story Complete

When a story's acceptance criteria are all checked off and the build passes:

1. Update the story file — change `status: In Progress` to `status: Done` in the header
2. Note any decisions or deviations in the story file's **"Implementation Notes"** section (add this section if it doesn't exist)
3. If Claude made a meaningful architectural decision that isn't obvious from the code, save it to `docs/claude_analysis/` as a new note file

---

## Checking Transitland Coverage Before Starting CLO-002

Before implementing the Transitland service, verify your area has coverage:

1. Go to [transit.land/map](https://www.transit.land/map)
2. Search for your target city/region
3. Confirm that the lines you expect appear (e.g. Metrolink, NCTD Coaster, BREEZE)

If coverage is missing, note it in CLO-002 and plan to use mock Transitland data for that area during development.
