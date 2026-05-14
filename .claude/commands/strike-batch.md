---
description: Mark a batch as shipped in docs/phase-batches.md and push to main.
---

You are striking through a completed batch in `docs/phase-batches.md`.

## Argument

The user invokes this as `/strike-batch N` where N is the batch number (e.g. `2`).

`$ARGUMENTS` contains the batch number. Trim whitespace; reject if it isn't a small positive integer.

## Steps

1. Read `/Users/craigrobinson/wc_2026_predictor/docs/phase-batches.md`.

2. Find the row that begins with `| $ARGUMENTS |` (the unstriked form) **or** `| ~~$ARGUMENTS~~ |` (already striked).

   - If no match: report `"Batch $ARGUMENTS not found in phase-batches.md"` and stop.
   - If already striked (`~~$ARGUMENTS~~`): report `"Batch $ARGUMENTS is already marked as shipped — nothing to do"` and stop.

3. Replace the row's cells with their struck-through form. The new row is:

   ```
   | ~~N~~ | ~~<model>~~ | ~~<phase list>~~ | ✅ Shipped YYYY-MM-DD |
   ```

   Use today's date (UTC) for `YYYY-MM-DD`. Preserve original spacing.

4. Commit and push to `main`:

   ```bash
   git -C /Users/craigrobinson/wc_2026_predictor add docs/phase-batches.md
   git -C /Users/craigrobinson/wc_2026_predictor commit -m "docs: mark Batch $ARGUMENTS shipped in phase-batches plan

   Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
   git -C /Users/craigrobinson/wc_2026_predictor push origin main
   ```

5. Report back with the new commit hash and the next un-struck batch (run `grep -n "^| [0-9] " docs/phase-batches.md | head -1`).

## Rules

- Never strike a batch whose phases are not all marked ✅ in `wc2026-architecture.md`. Before step 3, verify by greping each phase ID in the row — if any phase is missing its `✅ YYYY-MM-DD` suffix, stop and report which one.
- Never run on a dirty working tree. If `git status` shows untracked or modified files other than `docs/phase-batches.md`, stop and report — let the user resolve first.
