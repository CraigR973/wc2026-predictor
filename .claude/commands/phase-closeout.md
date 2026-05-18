---
description: Run the full phase close-out workflow — push, poll CI, merge to main, tick the architecture doc (phase mode only), append a lean session-log entry, strike the batch row. Supports both architecture phases (X.Y) and pre-launch review batches (RN).
---

You are running close-out. The user invokes this as one of:

```
/phase-closeout 7.1                  # single architecture phase
/phase-closeout 6.1,6.2,6.3,6.4      # multi-phase batch
/phase-closeout R1                   # pre-launch review batch
```

## Argument parsing & mode

`$ARGUMENTS` may be:

- **Phase mode** — comma-separated list of IDs matching `^\d+\.\d+$` (e.g. `7.1` or `6.1,6.2,6.3,6.4`). Trim whitespace, split on commas, validate each. Reject if any ID is malformed or if the list is empty.
- **Review mode** — a single token matching `^R\d+$` (e.g. `R1`). Reject if combined with phase IDs (mixed modes are not allowed in one close-out).

Set `$MODE` to `phase` or `review` based on the input shape. Many steps below behave differently per mode — read the per-step notes.

## Pre-conditions

Before doing anything, verify:

1. The feature work is **committed and pushed** to the current feature branch. Run `git -C /Users/craigrobinson/wc_2026_predictor status` — must be clean. Run `git -C /Users/craigrobinson/wc_2026_predictor log @{u}.. --oneline` — must be empty (no unpushed commits). If either check fails, stop and tell the user to push first.

2. The current branch is NOT `main`. Run `git -C /Users/craigrobinson/wc_2026_predictor branch --show-current`. If it's `main`, stop and report.

3. Tests, ruff, ruff format, and mypy all passed locally. Ask the user to confirm `"Did you run the full pytest + ruff + mypy locally and all green? (y/N)"`. If anything other than `y`/`yes`, stop.

## Steps

### Step 1 — Poll CI for the feature branch tip

Per the CI-polling rule in CLAUDE.md: **do not foreground-loop**. Pattern:

1. Get the tip SHA: `git -C /Users/craigrobinson/wc_2026_predictor rev-parse HEAD`.
2. Source the GitHub token: `source /Users/craigrobinson/wc_2026_predictor/.env` and then use `$GITHUB_TOKEN`.
3. One immediate check: `curl -s -H "Authorization: Bearer $GITHUB_TOKEN" "https://api.github.com/repos/CraigR973/wc2026-predictor/actions/runs?head_sha=$SHA"` and parse the first workflow_run's `status` and `conclusion`.
4. If `status` is `completed` and `conclusion` is `success`: continue to Step 2.
5. If `status` is `completed` and `conclusion` is anything else: stop and report which check failed — let the user fix and re-run.
6. If `status` is `in_progress` or `queued`: schedule a `run_in_background` bash that sleeps ~180 seconds, then runs the same curl. On notification, re-evaluate. Repeat at most twice (so max ~6 min wait). If still not done after that, ask the user how to proceed.

Never write more than ~3 polling lines into the conversation total.

### Step 2 — Fast-forward merge to main

```bash
git -C /Users/craigrobinson/wc_2026_predictor checkout main
git -C /Users/craigrobinson/wc_2026_predictor pull --ff-only origin main
BRANCH=$(git -C /Users/craigrobinson/wc_2026_predictor branch --show-current)  # store BEFORE checkout
git -C /Users/craigrobinson/wc_2026_predictor merge --ff-only <feature-branch>
git -C /Users/craigrobinson/wc_2026_predictor push origin main
```

Note: capture the feature branch name BEFORE the `checkout main` step.

If the merge is not fast-forwardable (main moved ahead with unrelated commits since the branch diverged), stop and ask the user to rebase the feature branch first.

### Step 3 — Tick the architecture doc for every phase ID

**Phase mode only.** Skip this step entirely in review mode (review items do not live in `wc2026-architecture.md`).

For each phase ID in `$ARGUMENTS`:

1. Grep for the heading: `grep -n "Phase X.Y:" /Users/craigrobinson/wc_2026_predictor/wc2026-architecture.md`.
2. If the line already ends with `✅ YYYY-MM-DD`, skip — don't double-tick.
3. Otherwise, edit the file to append ` ✅ YYYY-MM-DD` (today's UTC date) to the matching line.

Do NOT read the whole architecture doc — grep first, then use Edit with the precise line as the unique anchor.

### Step 4 — Append a lean session-log entry

Append a NEW section to the bottom of `/Users/craigrobinson/wc_2026_predictor/session-log.md` using the lean template defined in CLAUDE.md. Pull commit hashes from `git log main --oneline -<N>` where N covers the work just shipped (typically the last 1–3 commits before the docs commit you're about to make).

**Phase mode** — multi-phase batches get ONE section with all phase IDs in the title and all commit hashes on the Commits line:

```
---

## Phase X.Y[, X.Z] — Title[s]
**Commits:** <hash>[, <hash>] · CI ✅

### Key facts for future sessions
- <only non-obvious gotchas a future session can't discover by reading code or git log>
- <max ~6 bullets across the whole batch>

**Next:** Phase X.Z — Title (model tag)   ← use /next-batch-prompt logic to find this
```

**Review mode** — title is the batch ID plus the batch name (read it from the `docs/review-batches.md` row's "Rationale" column or its `## R<N>` section heading):

```
---

## Review batch R<N> — <Title from review-batches.md row>
**Commits:** <hash>[, <hash>] · CI ✅

### Key facts for future sessions
- <only non-obvious gotchas a future session can't discover by reading code or git log>
- <max ~6 bullets>

**Next:** Review batch R<N+1> — <Title> (model tag)   ← use /next-batch-prompt review to find this
```

Keep the entry under ~15 lines. Do NOT include "Files modified" or "What shipped" — they're recoverable from `git show --stat`.

### Step 5 — Commit the docs changes

**Phase mode:**

```bash
git -C /Users/craigrobinson/wc_2026_predictor add wc2026-architecture.md session-log.md
git -C /Users/craigrobinson/wc_2026_predictor commit -m "docs: close out phase(s) $ARGUMENTS — arch doc tick + session log

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
git -C /Users/craigrobinson/wc_2026_predictor push origin main
```

**Review mode** (no arch doc to tick — session-log only):

```bash
git -C /Users/craigrobinson/wc_2026_predictor add session-log.md
git -C /Users/craigrobinson/wc_2026_predictor commit -m "docs: close out review batch $ARGUMENTS — session log

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
git -C /Users/craigrobinson/wc_2026_predictor push origin main
```

### Step 6 — Strike the batch row

**Phase mode:** invoke `/strike-batch N` where N is the batch number that contains these phase IDs in `docs/phase-batches.md` (grep the file for a row whose 3rd column lists them).

**Review mode:** invoke `/strike-batch $ARGUMENTS` directly — `$ARGUMENTS` is already the R-batch identifier (e.g. `R1`). The skill handles the file routing.

The result is one more docs commit on `main`.

### Step 7 — Report

Output a short summary to the user:

**Phase mode:**
- Phase(s) closed: X.Y[, X.Z]
- Feature commit(s): <hashes>
- Docs commits: <2 hashes>
- Batch row struck: Batch N
- CI: ✅
- Next batch hint: run `/next-batch-prompt` to get the prompt for the next session

**Review mode:**
- Review batch closed: R<N>
- Feature commit(s): <hashes>
- Docs commits: <1–2 hashes>
- Batch row struck: R<N>
- CI: ✅
- Next batch hint: run `/next-batch-prompt review` to get the prompt for the next session

That's it.

## Rules

- Never use `git push --force` or `git push --no-verify`.
- Never amend a previous commit — always create new commits.
- Never write to `permissions.deny` or skip pre-commit hooks.
- If anything fails mid-flow, stop and report the exact failure. Don't try to clean up — let the user decide.
