---
description: Generate the next-batch paste-prompt. No-arg or `phase` → docs/phase-batches.md + wc2026-architecture.md. `review` → docs/review-batches.md (acceptance inline). Mechanical, no hallucination.
---

You are generating the copy-paste prompt for the next batch. Follow these steps **literally** — do not skip, do not infer.

## Mode

`$ARGUMENTS` selects the source:

- empty or `phase` → **phase mode**: `docs/phase-batches.md` + `wc2026-architecture.md` (legacy default)
- `review` → **review mode**: `docs/review-batches.md` only (acceptance criteria live in the per-batch sub-sections of that same file)

Reject any other value with `"Unknown mode '$ARGUMENTS' — use empty/phase or 'review'"`.

Per-step notes call out where the modes diverge.

## Step 1 — Find the next batch

**Phase mode:**

```bash
grep -n "^| [0-9~]" /Users/craigrobinson/wc_2026_predictor/docs/phase-batches.md
```

The first row whose batch number is NOT wrapped in `~~...~~` (i.e. not struck through) is the next batch. Extract:
- **Batch number** (e.g. `2`)
- **Model tag** (`🟢 Sonnet` or `🔴 Opus`)
- **Phase IDs** (comma-separated, e.g. `7.2, 7.4`)

If every row is struck through, report "All batches complete — consult `wc2026-architecture.md` for any remaining unticked phases" and stop.

**Review mode:**

```bash
grep -nE "^\| R[0-9~]" /Users/craigrobinson/wc_2026_predictor/docs/review-batches.md
```

The first row whose batch id is NOT wrapped in `~~...~~` is the next review batch. Extract:
- **Batch id** (e.g. `R1`)
- **Model tag** (`🟢 Sonnet` or `🔴 Opus`) and reasoning hint (e.g. `(extended thinking)`)
- **Effort** (e.g. `~2 h`)
- **Items range** (e.g. `R1.1–R1.5`)

If every row is struck through, report "All review batches shipped" and stop.

## Step 2 — Pull acceptance criteria verbatim

**Phase mode:** for each phase ID extracted in Step 1, run:

```bash
grep -n -A 8 "Phase X.Y:" /Users/craigrobinson/wc_2026_predictor/wc2026-architecture.md
```

(Substitute `X.Y` for the actual ID.) If any grep returns no match, **STOP** and tell the user: "Phase `X.Y` does not exist in the architecture doc. Check `docs/phase-batches.md` for a typo." Do not invent acceptance criteria.

Copy the bullets verbatim, including the **Acceptance:** line. Do not paraphrase.

**Review mode:** acceptance criteria live INLINE in `docs/review-batches.md`. Read the `## R<N> — <Title>` section of that file for the batch you identified in Step 1. Capture:
- The section title (the part after `— `)
- The one-line summary of each item (lead clause before the first `(` or `.`)
- The **Acceptance:** paragraph at the end of the section

Do **not** grep `wc2026-architecture.md` in review mode — review items are not in it. If the section is missing, stop and report.

## Step 3 — Anchor with recent commit hashes

Run:

```bash
git -C /Users/craigrobinson/wc_2026_predictor log --oneline -10
```

Identify the commits for the most-recently-shipped phase (the immediately preceding batch). You will reference those hashes in the PREVIOUS SESSION NOTES so the future session can run `git show <hash>` instead of grepping.

## Step 4 — Pull non-obvious gotchas from the previous batch's session-log entry

Run:

```bash
grep -n -B 1 -A 20 "## Phase" /Users/craigrobinson/wc_2026_predictor/session-log.md | tail -60
```

Read the most recent 1–2 entries. Their `### Key facts for future sessions` bullets are candidates for the new PREVIOUS SESSION NOTES, but only carry forward those that are still relevant to the upcoming batch. Skip anything specific to the just-shipped work.

## Step 5 — Emit the prompt

Output the prompt in this exact format (no preamble, no commentary, just the prompt inside a fenced code block so the user can copy it).

**Phase mode:**

````
```
Batch N: Phases X.Y → X.Z — back-to-back, single <model> session.
Close each phase fully before starting the next.   ← include this line only if batch has 2+ phases

Phase X.Y: <Title> <model emoji + tag>
- <acceptance bullet verbatim>
- <acceptance bullet verbatim>
- Acceptance: <acceptance line verbatim>

Phase X.Z: ...   ← repeat per phase in the batch

PREVIOUS SESSION NOTES:
- <non-obvious gotcha, anchored to a commit hash when useful>
- <max ~6 bullets>
- <stop if you cannot think of >3 genuinely non-obvious things — better short than padded>
```
````

**Review mode:**

````
```
# Batch R<N> — <Title>

You're starting a fresh session for the World Cup 2026 Prediction League
pre-launch fixes. Read `CLAUDE.md` in the repo root for project conventions
(branch naming, commit format, test discipline, bash patterns).

**STEP 1 before anything else:** make sure `main` is up to date and create
the feature branch:

    git fetch origin && git checkout main && git pull --ff-only origin main
    git checkout -b fix/r<n>-<slug>     ← slug derived from the batch title

Do not commit to `main` directly under any circumstance.

This batch implements **<items range>** from `docs/review-batches.md`. Open
that file and read the entire **R<N> — <Title>** section before starting —
it has the exact file paths, line numbers, and per-item acceptance criteria.
Don't infer the spec from this prompt; the source of truth is the doc.

**Model & effort:** sized for <model emoji + tag>, <effort>. <reasoning hint
verbatim from the batch row, e.g. "Standard thinking — nothing in this
batch needs extended reasoning." or "Extended thinking ON — race/transaction
reasoning matters.">. If you're not on the named model, ask the user before
continuing.

Items to ship (full spec in the doc):
- R<N>.1 — <one-line summary>
- R<N>.2 — <one-line summary>
- ...

**Acceptance gate before you stop:**
- All items done per the R<N> section of `docs/review-batches.md`
- New tests added per the doc's acceptance bullets
- `PYTHONPATH=/Users/craigrobinson/wc_2026_predictor/apps/api /Users/craigrobinson/wc_2026_predictor/apps/api/.venv/bin/python -m pytest /Users/craigrobinson/wc_2026_predictor/apps/api/tests` green (or frontend equivalent if the batch is frontend-only)
- `ruff check` and `mypy src` green (backend); `pnpm test` green (frontend)
- Push the branch (`git push -u origin fix/r<n>-<slug>`) and confirm CI green — use the cached endpoint or one background poll, do NOT foreground-poll (see CLAUDE.md bash discipline)

**Do not merge.** Stop after CI is green. The user will run `/phase-closeout
R<N>` to merge to `main`, append the session-log entry, and strike the row
in `docs/review-batches.md`.

PREVIOUS SESSION NOTES:
- <non-obvious gotchas from the most recent review-batch session-log entry,
  anchored to a commit hash when useful — max ~6 bullets, or omit the whole
  block if this is R1 or there are no genuinely non-obvious items>
```
````

After emitting the prompt, on a new line, remind the user: "Paste into a fresh **<model>** session. After it starts, run `/strike-batch <id>` (or edit the batches doc manually) to mark this batch in-flight." The `<id>` is `N` in phase mode and `R<N>` in review mode.

## Rules

- Never include "Files modified" or "What shipped" sections.
- Never include date, model tag, or commit hashes as a metadata header — those belong in session-log entries, not the next-batch prompt.
- Never propose a model different from what's in the batch row.
- Never quote acceptance criteria from memory — always grep them fresh from the source doc (architecture doc in phase mode, `review-batches.md` in review mode).
- If anything looks inconsistent (struck-through row but phase not ✅ in arch doc, or vice versa — phase mode only), stop and ask the user.
