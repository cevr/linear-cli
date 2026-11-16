# Recorded TypeScript output

The property and regression cases used to run the TypeScript CLI beside the
port. That source is gone now (owner, 2026-11-15), so each case checks the Ergo
build against what the TypeScript CLI printed, exited, wrote and sent to the
fake Linear. The output was recorded once, at commit 8221817 (the last with the
source), and is checked in here.

One file per suite and seed, with one entry per case:

- `property-1000.json`: `bun parity/run.ts --property=1000` (twelve worlds,
  seeds 1000-1011);
- `regressions-<L>-42.json`: `bun parity/run.ts --regressions=<L> --seed=42`
  for L0, L3, L4 and LUTF8;
- `regressions-L3-1000.json`: the L3 cases at seed 1000, which two mutants use.

Other seeds have no record: a run at one fails and names the missing file. A
check that meets a case with no record fails, and a full run fails when a
record is never used, so the corpus and the records cannot drift apart. The
recording was made in one scratch folder and checked in another, so no record
holds a scratch path.
