---
description: Run the full phase close-out workflow — push, poll CI, merge to main, tick the architecture doc (architecture phase mode only), append a lean session-log entry, strike the batch row. Supports architecture phases (X.Y), multi-league batches (MN), pre-launch review batches (RN), and premium polish batches (UN).
---

You are running close-out. The user invokes this as one of:

```
/phase-closeout 7.1                  # single architecture phase
/phase-closeout 6.1,6.2,6.3,6.4      # multi-phase architecture batch
/phase-closeout M1                   # multi-league batch
/phase-closeout R1                   # pre-launch review batch
/phase-closeout U3                   # premium polish batch
```

## Argument parsing & mode

`$ARGUMENTS` may be:

- **Phase mode** — comma-separated list of IDs matching `^\d+\.\d+$` (e.g. `7.1` or `6.1,6.2,6.3,6.4`). Trim whitespace, split on commas, validate each. Reject if any ID is malformed or if the list is empty.
- **Multi-league mode** — a single token matching `^M\d+$` (e.g. `M1`). Multi-league batches tracked in `docs/phase-batches.md` "Multi-league (v1)" section; acceptance criteria in `docs/multi-league-architecture.md` § 8. Reject if combined with other IDs.
- **Review mode** — a single token matching `^R\d+$` (e.g. `R1`). Reject if combined with phase IDs.
- **Polish mode** — a single token matching `^U\d+$` (e.g. `U3`). Frontend-only polish batches tracked in `docs/polish-batches.md`. Reject if combined with other IDs.

Set `$MODE` to `phase`, `multi-league`, `review`, or `polish` based on the input shape. Many steps below behave differently per mode — read the per-step notes.

## Pre-conditions

Before doing anything, verify:

1. The feature work is **committed and pushed** to the current feature branch. Run `git -C /Users/craigrobinson/wc_2026_predictor status` — must be clean. Run `git -C /Users/craigrobinson/wc_2026_predictor log @{u}.. --oneline` — must be empty (no unpushed commits). If either check fails, stop and tell the user to push first.

2. The current branch is NOT `main`. Run `git -C /Users/craigrobinson/wc_2026_predictor rev-parse --abbrev-ref HEAD` (older Git missing `branch --show-current` — fall back to `git symbolic-ref --short HEAD` if needed). If it's `main`, stop and report — **with a recovery hint:** the implementer session likely skipped the STEP 1 branch-cut in the next-batch-prompt. To recover, run:

   ```bash
   git -C /Users/craigrobinson/wc_2026_predictor checkout -b feat/<slug>   # carries unstaged changes
   git -C /Users/craigrobinson/wc_2026_predictor add <files>
   git -C /Users/craigrobinson/wc_2026_predictor commit -F /tmp/msg.txt    # avoid shell quoting traps
   git -C /Users/craigrobinson/wc_2026_predictor push -u origin feat/<slug>
   ```

   then re-run `/phase-closeout`.

3. **Phase, multi-league, and review mode:** Tests, ruff, ruff format, and mypy all passed locally. Ask the user to confirm `"Did you run the full pytest + ruff + mypy locally and all green? (y/N)"`. If anything other than `y`/`yes`, stop. **Skip this confirmation in polish mode** — polish batches are frontend-only (pnpm test + typecheck), which CI already verified.

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

**Phase mode only.** Skip this step entirely in multi-league, review, and polish mode (those items do not live in `wc2026-architecture.md`). For multi-league mode specifically: `docs/multi-league-architecture.md` § 8 was written without ✅ markers by design — the "shipped" signal is the struck-through row in `docs/phase-batches.md`.

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

**Multi-league mode** — title is the batch ID plus the section heading title from `docs/multi-league-architecture.md` § 8 (everything after `### M<n> · `, stripped of the trailing model emoji + tag):

```
---

## Multi-league batch M<n> — <Title from § 8 heading>
**Commits:** <hash>[, <hash>] · CI ✅

### Key facts for future sessions
- <only non-obvious gotchas a future session can't discover by reading code or git log>
- <max ~6 bullets>

**Next:** Multi-league batch M<n+1> — <Title> (model tag)   ← use /next-batch-prompt to find this
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

**Polish mode** — title is the batch ID plus the `## U<N> — ...` heading from `docs/polish-batches.md`:

```
---

## Polish batch U<N> — <Title from polish-batches.md heading>
**Commits:** <hash>[, <hash>] · CI ✅

### Key facts for future sessions
- <only non-obvious gotchas a future session can't discover by reading code or git log>
- <max ~6 bullets>

**Next:** Polish batch U<N+1> — <Title> (model tag)
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

**Multi-league mode** (no arch doc to tick — session-log only):

```bash
git -C /Users/craigrobinson/wc_2026_predictor add session-log.md
git -C /Users/craigrobinson/wc_2026_predictor commit -m "docs: close out multi-league batch $ARGUMENTS — session log

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

**Polish mode** (no arch doc to tick — session-log only):

```bash
git -C /Users/craigrobinson/wc_2026_predictor add session-log.md
git -C /Users/craigrobinson/wc_2026_predictor commit -m "docs: close out polish batch $ARGUMENTS — session log

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
git -C /Users/craigrobinson/wc_2026_predictor push origin main
```

### Step 6 — Strike the batch row

**Phase mode:** invoke `/strike-batch N` where N is the batch number that contains these phase IDs in `docs/phase-batches.md` (grep the file for a row whose 3rd column lists them).

**Multi-league mode:** invoke `/strike-batch $ARGUMENTS` directly — `$ARGUMENTS` is already the M-batch identifier (e.g. `M1`). The skill handles the file routing (`docs/phase-batches.md`, "Multi-league (v1)" section).

**Review mode:** invoke `/strike-batch $ARGUMENTS` directly — `$ARGUMENTS` is already the R-batch identifier (e.g. `R1`). The skill handles the file routing.

**Polish mode:** invoke `/strike-batch $ARGUMENTS` directly — `$ARGUMENTS` is already the U-batch identifier (e.g. `U3`). The skill handles the file routing (`docs/polish-batches.md`).

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

**Multi-league mode:**
- Multi-league batch closed: M<n>
- Feature commit(s): <hashes>
- Docs commits: <1–2 hashes>
- Batch row struck: M<n>
- CI: ✅
- Next batch hint: run `/next-batch-prompt` to get the prompt for the next session (the skill auto-detects whether the next un-struck row is architecture or multi-league)

**Review mode:**
- Review batch closed: R<N>
- Feature commit(s): <hashes>
- Docs commits: <1–2 hashes>
- Batch row struck: R<N>
- CI: ✅
- Next batch hint: run `/next-batch-prompt review` to get the prompt for the next session

**Polish mode:**
- Polish batch closed: U<N>
- Feature commit(s): <hashes>
- Docs commit: <hash>
- Batch row struck: U<N> in `docs/polish-batches.md`
- CI: ✅
- Next batch hint: paste the next `## U<N+1>` section from `docs/polish-batches.md` into the next session

That's it.

## Rules

- Never use `git push --force` or `git push --no-verify`.
- Never amend a previous commit — always create new commits.
- Never write to `permissions.deny` or skip pre-commit hooks.
- If anything fails mid-flow, stop and report the exact failure. Don't try to clean up — let the user decide.
