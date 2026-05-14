---
description: Generate the next-phase paste-prompt from docs/phase-batches.md + wc2026-architecture.md. Mechanical, no hallucination.
---

You are generating the copy-paste prompt for the next batch of phases. Follow these steps **literally** — do not skip, do not infer.

## Step 1 — Find the next batch

Run:

```bash
grep -n "^| [0-9~]" /Users/craigrobinson/wc_2026_predictor/docs/phase-batches.md
```

The first row whose batch number is NOT wrapped in `~~...~~` (i.e. not struck through) is the next batch. Extract:
- **Batch number** (e.g. `2`)
- **Model tag** (`🟢 Sonnet` or `🔴 Opus`)
- **Phase IDs** (comma-separated, e.g. `7.2, 7.4`)

If every row is struck through, report "All batches complete — consult `wc2026-architecture.md` for any remaining unticked phases" and stop.

## Step 2 — Pull acceptance criteria verbatim

For each phase ID extracted in Step 1, run:

```bash
grep -n -A 8 "Phase X.Y:" /Users/craigrobinson/wc_2026_predictor/wc2026-architecture.md
```

(Substitute `X.Y` for the actual ID.) If any grep returns no match, **STOP** and tell the user: "Phase `X.Y` does not exist in the architecture doc. Check `docs/phase-batches.md` for a typo." Do not invent acceptance criteria.

Copy the bullets verbatim, including the **Acceptance:** line. Do not paraphrase.

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

Output the prompt in this exact format (no preamble, no commentary, just the prompt inside a fenced code block so the user can copy it):

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

After emitting the prompt, on a new line, remind the user: "Paste into a fresh **<model>** session. After it starts, run `/strike-batch <N>` (or edit `docs/phase-batches.md` manually) to mark this batch in-flight."

## Rules

- Never include "Files modified" or "What shipped" sections.
- Never include date, model tag, or commit hashes as a metadata header — those belong in session-log entries, not the next-phase prompt.
- Never propose a model different from what's in the batch row.
- Never quote acceptance criteria from memory — always grep them fresh from the architecture doc.
- If anything looks inconsistent (struck-through row but phase not ✅ in arch doc, or vice versa), stop and ask the user.
