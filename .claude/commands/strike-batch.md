---
description: Mark a batch as shipped in docs/phase-batches.md (architecture phases and M-batches), docs/review-batches.md (R-batches), docs/polish-batches.md (U-batches), or docs/env-batches.md (E-batches), and push to main.
---

You are striking through a completed batch.

## Argument & mode

The user invokes this as `/strike-batch N` (architecture phases), `/strike-batch MN` (multi-league batches), `/strike-batch RN` (pre-launch review batches), `/strike-batch UN` (premium polish batches), or `/strike-batch EN` (env/ops batches), e.g. `/strike-batch 2`, `/strike-batch M1`, `/strike-batch R1`, `/strike-batch U3`, `/strike-batch E1`.

`$ARGUMENTS` contains the batch identifier. Trim whitespace, then:

- If it matches `^\d+$` → **phase mode**. Set `$FILE = /Users/craigrobinson/wc_2026_predictor/docs/phase-batches.md`.
- If it matches `^M\d+$` (case-sensitive `M`) → **multi-league mode**. Set `$FILE = /Users/craigrobinson/wc_2026_predictor/docs/phase-batches.md` (same file as phase mode; M-rows live in the "Multi-league (v1)" section).
- If it matches `^R\d+$` (case-sensitive `R`) → **review mode**. Set `$FILE = /Users/craigrobinson/wc_2026_predictor/docs/review-batches.md`.
- If it matches `^U\d+$` (case-sensitive `U`) → **polish mode**. Set `$FILE = /Users/craigrobinson/wc_2026_predictor/docs/polish-batches.md`.
- If it matches `^E\d+$` (case-sensitive `E`) → **env mode**. Set `$FILE = /Users/craigrobinson/wc_2026_predictor/docs/env-batches.md`.
- Otherwise reject with `"Invalid batch id '$ARGUMENTS' — expected a positive integer, M<integer>, R<integer>, U<integer>, or E<integer>"`.

Throughout the steps below, use `$FILE` for the file path and `$ARGUMENTS` for the literal row identifier (which is `2` or `R1`).

## Steps

1. Read `$FILE`.

2. Find the row that begins with `| $ARGUMENTS |` (the unstriked form) **or** `| ~~$ARGUMENTS~~ |` (already striked).

   - If no match: report `"Batch $ARGUMENTS not found in $FILE"` and stop.
   - If already striked (`~~$ARGUMENTS~~`): report `"Batch $ARGUMENTS is already marked as shipped — nothing to do"` and stop.

3. Replace the row's cells with their struck-through form. The new row is:

   ```
   | ~~N~~ | ~~<model>~~ | ~~<phase list>~~ | ✅ Shipped YYYY-MM-DD |
   ```

   Use today's date (UTC) for `YYYY-MM-DD`. Preserve original spacing.

4. Commit and push to `main`:

   ```bash
   git -C /Users/craigrobinson/wc_2026_predictor add $FILE
   git -C /Users/craigrobinson/wc_2026_predictor commit -m "docs: mark Batch $ARGUMENTS shipped

   Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
   git -C /Users/craigrobinson/wc_2026_predictor push origin main
   ```

5. Report back with the new commit hash and the next un-struck batch in `$FILE` (run `grep -nE "^\| ([MRUNE]?[0-9]+) " $FILE | head -1` — the regex covers `| 2 `, `| M1 `, `| R3 `, `| U4 `, and `| E1 `).

## Rules

- **Phase mode only** (numeric IDs): never strike a batch whose phases are not all marked ✅ in `wc2026-architecture.md`. Before step 3, verify by greping each phase ID in the row — if any phase is missing its `✅ YYYY-MM-DD` suffix, stop and report which one. **Skip this rule entirely in multi-league, review, polish, and env mode** — those items do not live in `wc2026-architecture.md`; for multi-league/review/polish the "shipped" signal is the feature branch merged to `main`; for env mode the "shipped" signal is all acceptance criteria verified via CLI. (Multi-league acceptance criteria live in `docs/multi-league-architecture.md`; env acceptance criteria live in `docs/env-batches.md`.)
- Never run on a dirty working tree. If `git status` shows untracked or modified files other than `$FILE`, stop and report — let the user resolve first.
