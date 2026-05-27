---
description: Generate the next-batch paste-prompt. No-arg or `phase` → docs/phase-batches.md (numeric architecture phases AND M-batches; acceptance pulled from wc2026-architecture.md or docs/multi-league-architecture.md depending on the batch id). `review` → docs/review-batches.md (acceptance inline). `polish` → docs/polish-batches.md (acceptance inline). Mechanical, no hallucination.
---

You are generating the copy-paste prompt for the next batch. Follow these steps **literally** — do not skip, do not infer.

## Mode

`$ARGUMENTS` selects the source:

- empty or `phase` → **phase mode**: `docs/phase-batches.md`. The first un-struck row determines the **sub-mode**:
  - row id matches `^\d+$` (e.g. `13`) → **architecture sub-mode**: acceptance from `wc2026-architecture.md`
  - row id matches `^M\d+$` (e.g. `M1`) → **multi-league sub-mode**: acceptance from `docs/multi-league-architecture.md` (§ 8 `### M<n> ·` headings)
- `review` → **review mode**: `docs/review-batches.md` only (acceptance criteria live in the per-batch sub-sections of that same file)
- `polish` → **polish mode**: `docs/polish-batches.md` only (spec and acceptance live inline per `## U<N>` section)

Reject any other value with `"Unknown mode '$ARGUMENTS' — use empty/phase, 'review', or 'polish'"`.

Per-step notes call out where the modes (and phase sub-modes) diverge.

## Step 1 — Find the next batch

**Polish mode:**

```bash
grep -nE "^\| U[0-9~]" /Users/craigrobinson/wc_2026_predictor/docs/polish-batches.md
```

The first row whose batch id is NOT wrapped in `~~...~~` is the next polish batch. Extract:
- **Batch id** (e.g. `U4`)
- **Model tag** and any reasoning hint (e.g. `🟢 Sonnet` or `🔴 Opus (extended thinking)`)
- **Effort** (e.g. `~3.5 h`)
- **Items range** (e.g. `U4.1–U4.7`)

If every row is struck through, report "All polish batches shipped — run the full verification checklist in `docs/polish-batches.md` before merging `feat/premium-polish` to main" and stop.



**Phase mode:**

```bash
grep -nE "^\| [0-9~M]" /Users/craigrobinson/wc_2026_predictor/docs/phase-batches.md
```

The first row whose batch id is NOT wrapped in `~~...~~` (i.e. not struck through) is the next batch. Extract:
- **Batch id** (e.g. `2` or `M1`) — set sub-mode by regex match (`^\d+$` → architecture, `^M\d+$` → multi-league)
- **Model tag** (`🟢 Sonnet` or `🔴 Opus`)
- **Phase IDs** (architecture sub-mode: comma-separated, e.g. `7.2, 7.4`; multi-league sub-mode: a single `M<n>` id, e.g. `M1`)

If every row is struck through, report "All batches complete — consult `wc2026-architecture.md` and `docs/multi-league-architecture.md` for any remaining unticked phases" and stop.

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

**Phase mode — architecture sub-mode** (numeric IDs like `7.2`): for each phase ID extracted in Step 1, run:

```bash
grep -n -A 8 "Phase X.Y:" /Users/craigrobinson/wc_2026_predictor/wc2026-architecture.md
```

(Substitute `X.Y` for the actual ID.) If any grep returns no match, **STOP** and tell the user: "Phase `X.Y` does not exist in the architecture doc. Check `docs/phase-batches.md` for a typo." Do not invent acceptance criteria.

Copy the bullets verbatim, including the **Acceptance:** line. Do not paraphrase.

**Phase mode — multi-league sub-mode** (IDs like `M1`): for the M-id extracted in Step 1, run:

```bash
grep -n -A 14 "^### M<n> ·" /Users/craigrobinson/wc_2026_predictor/docs/multi-league-architecture.md
```

(Substitute `<n>` for the actual digit.) The section bullets are the work; the `- **Acceptance:**` sub-block lists the gate. If grep returns no match, **STOP** and tell the user: "Batch `M<n>` does not exist in `docs/multi-league-architecture.md` § 8. Check `docs/phase-batches.md` for a typo." Do not invent acceptance criteria.

Copy the heading title (everything after `### M<n> · `) and all bullets verbatim. The model tag is at the end of the heading line — confirm it matches the row's model tag and stop if they disagree.

**Review mode:** acceptance criteria live INLINE in `docs/review-batches.md`. Read the `## R<N> — <Title>` section of that file for the batch you identified in Step 1. Capture:
- The section title (the part after `— `)
- The one-line summary of each item (lead clause before the first `(` or `.`)
- The **Acceptance:** paragraph at the end of the section

Do **not** grep `wc2026-architecture.md` in review mode — review items are not in it. If the section is missing, stop and report.

**Polish mode:** spec and acceptance live INLINE in `docs/polish-batches.md`. Read the `## U<N> — <Title>` section for the batch you identified in Step 1. Capture:
- The section title (the part after `— `)
- The one-line summary of each numbered item (the `**U<N>.<M>**` lead clause)
- The entire **Acceptance:** block at the end of the section

Do **not** grep `wc2026-architecture.md` in polish mode. If the section is missing, stop and report.

## Step 3 — Anchor with recent commit hashes

Run:

```bash
git -C /Users/craigrobinson/wc_2026_predictor log --oneline -10
```

Identify the commits for the most-recently-shipped phase (the immediately preceding batch). You will reference those hashes in the PREVIOUS SESSION NOTES so the future session can run `git show <hash>` instead of grepping.

## Step 4 — Pull non-obvious gotchas from the previous batch's session-log entry

Run:

```bash
grep -nE "^## (Phase|Multi-league batch|Review batch|Polish batch)" /Users/craigrobinson/wc_2026_predictor/session-log.md | tail -3
```

Read the most recent 1–2 entries (use `Read` with `offset` + `limit` based on the line numbers from the grep). Their `### Key facts for future sessions` bullets are candidates for the new PREVIOUS SESSION NOTES, but only carry forward those that are still relevant to the upcoming batch. Skip anything specific to the just-shipped work.

## Step 5 — Emit the prompt

Output the prompt in this exact format (no preamble, no commentary, just the prompt inside a fenced code block so the user can copy it).

**Phase mode — architecture sub-mode** (numeric IDs):

````
```
Batch N: Phases X.Y → X.Z — back-to-back, single <model> session.

**STEP 1 before anything else:** make sure `main` is up to date and create
the feature branch:

    git fetch origin && git checkout main && git pull --ff-only origin main
    git checkout -b feat/b<N>-<slug>     ← slug derived from the batch title

Do not commit to `main` directly under any circumstance. `/phase-closeout`
will fast-forward this branch into `main` once CI is green.

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

**Phase mode — multi-league sub-mode** (`M<n>` IDs):

````
```
Batch M<n>: <Title from § 8 heading> — single <model emoji + tag> session.

**STEP 1 before anything else:** make sure `main` is up to date and create
the feature branch:

    git fetch origin && git checkout main && git pull --ff-only origin main
    git checkout -b feat/m<n>-<slug>     ← slug derived from the batch title

Do not commit to `main` directly under any circumstance. `/phase-closeout`
will fast-forward this branch into `main` once CI is green.

The M-series batch acceptance criteria live in `docs/multi-league-architecture.md` § 8 (NOT in `wc2026-architecture.md`). Skim § 2.2 (decision rationale), § 3 (data model + DDL), § 4 (auth flow), and § 7 (migration plan) before touching code — they were written specifically for this implementer.

Phase M<n>: <Title> <model emoji + tag>
- <bullet verbatim from § 8>
- <bullet verbatim from § 8>
- Acceptance:
  - <acceptance bullet verbatim>
  - <acceptance bullet verbatim>

PREVIOUS SESSION NOTES:
- <non-obvious gotcha, anchored to a commit hash when useful>
- <include the design-doc commit hash so the implementer can run `git show <hash>` for context>
- <max ~6 bullets — stop if you cannot think of >3 genuinely non-obvious things>
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

**Polish mode:**

````
```
You are continuing work on the **World Cup 2026 Prediction League** PWA ("The Steele Spreadsheet System") — a FastAPI + React 18 + Tailwind + shadcn/ui app. The working branch is `feat/premium-polish`. Pull it before starting.

---

## Your task: <batch-id> — <Title> (~<effort>) <model emoji + tag>

All <N> sub-tasks below must be completed and their acceptance criteria verified before close-out. Do NOT close out — I'll run `/phase-closeout <batch-id>` myself once I've reviewed staging.

<--- paste the full ## U<N> section body from docs/polish-batches.md verbatim here --->

---

## Acceptance checklist

<--- paste the Acceptance: bullets from the ## U<N> section verbatim --->

---

## Environment reminders

- Branch: `feat/premium-polish` — pull before starting
- Frontend test: `PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH" pnpm --dir /Users/craigrobinson/wc_2026_predictor/apps/web test`
- Typecheck: `PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH" pnpm --dir /Users/craigrobinson/wc_2026_predictor/apps/web typecheck`
- Lint: `PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH" pnpm --dir /Users/craigrobinson/wc_2026_predictor/apps/web lint`
- Never `cd` — use absolute paths
- After all tasks are done and tests are green, push `feat/premium-polish` and let CI run. Do NOT merge to `staging` or `main` — I'll do that after review.
- Commit with Conventional Commits format
- Do NOT run `/phase-closeout` — I'll trigger that manually

PREVIOUS SESSION NOTES:
- <non-obvious gotchas from the most recent polish-batch session-log entry — max ~6 bullets>
- <include the commit hash(es) of the previous batch so the next session can run `git show <hash>`>
- <omit this whole block if there are no genuinely non-obvious items>
```
````

After emitting the prompt, on a new line, remind the user: "Paste into a fresh **<model>** session. After it starts, run `/strike-batch <id>` (or edit the batches doc manually) to mark this batch in-flight." The `<id>` is `N` in phase mode architecture sub-mode, `M<n>` in phase mode multi-league sub-mode, `R<N>` in review mode, and `U<N>` in polish mode.

## Rules

- Never include "Files modified" or "What shipped" sections.
- Never include date, model tag, or commit hashes as a metadata header — those belong in session-log entries, not the next-batch prompt.
- Never propose a model different from what's in the batch row.
- Never quote acceptance criteria from memory — always grep them fresh from the source doc (architecture sub-mode → `wc2026-architecture.md`; multi-league sub-mode → `docs/multi-league-architecture.md`; review mode → `docs/review-batches.md`; polish mode → `docs/polish-batches.md`).
- If anything looks inconsistent (architecture sub-mode: struck-through row but phase not ✅ in arch doc, or vice versa; multi-league sub-mode: batch row's model tag disagrees with the § 8 heading's model tag), stop and ask the user.
