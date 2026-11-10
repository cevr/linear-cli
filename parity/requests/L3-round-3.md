ready

Protocol: supplied orchestrate worker protocol, Implementor (protocol.md/safety.md not read).
Spec: orchestrator round-3 message (wf10 linear-cli fix round 3) and `L3/round-2-findings.md`; no phase spec.md exists.
Head: `215c4ed745d71a615eae1cd38ed06e43229c267d` (code; the request-mirror commit follows).
Base: `adf6112a90df85ff60add9e8d77a213c45f70884` (round 2 verified; its code is `d7e810a`).
Diff: `git diff --stat adf6112a..215c4ed | tail -1` = `15 files changed, 906 insertions(+), 76 deletions(-)` (one commit for L0, L3 and L4).
Clone: `/home/exedev/Developer/personal/.worktrees/linear-ergo`, branch `ergo-port`; compiler pin `50facc08` unchanged; no push; link unchanged.

## Fix report

- M1 (the workspace-file generator omits PermissionDenied): fixed 215c4ed. No product change was needed; the head was already correct on these states (r2 findings). The guard was missing.
  - `parity/regressions.ts` `fileStates(seed)`: one generated failing state per errno class that `platformKind` and the `fs` arms map, at the step that meets it: ENOENT at realPath (missing file, missing directory, dangling link), ENOTDIR at realPath (a file as a directory component), EISDIR at readFile (a directory), ELOOP at realPath (a self-loop link), EACCES at realPath (a path through a mode-000 directory) and EACCES at readFile (a mode-000 file). The seed varies names and nesting depth (0–2 directories). Each compares exact stdout/stderr/status/files with the compiled TS control.
  - `parity/corpus.ts`, `parity/run.ts`: a case may carry `links` and `modes`. The runner applies them after files, restores readable modes before the snapshot and on every exit path, snapshots symlinks with `lstat` as `{path, link}`, and exports both to `setup.sh` for recorded cases.
  - Mutants (declared in `parity/MUTANTS.md` round 3): `query-file-realpath-denied-unknown` (the verifier's V1: delete the `permission denied` arm) killed by `regression-L3-file-6` (mode-000 directory); `query-file-denied-unknown` (V2: `fs.Denied` prints `Unknown`) killed by `regression-L3-file-7` (mode-000 file). Both parity mismatches against the TS control. `query-file-loses-platform-detail` still killed by `file-0`.

## Run

Source `../linear-r3-env.sh`; build with `sh ../linear-r3-build.sh` (compiler from `git archive 50facc08`, see the L0 request). Then `bun parity/run.ts --regressions=L3 --seed=1000 [--trace]`; one mutant: `bun parity/mutants.ts --only=query-file-denied-unknown`.

## Receipts (measured)

- Gate: `sh ../linear-r3-gate.sh` → `L3/gate-3.log`, exit line `GATE EXIT: 0` (L3 regressions at 42, 1000, 7: 118 cases each; full ledger, 62 killed).
- Acceptance at the code head: `sh ../linear-r3-accept.sh` → `L3/accept-3.log`, exit line `ACCEPT EXIT: 0` (`--regressions=L3 --seed=1000`: 118; `--phase=3`: 61).
- Red: the round-2 head's native passes the new states (`L3/red-3.log`, `EXIT: 0 (118 cases)`), as expected: the product was right and the guard was missing. The two mutants are the red evidence (`L4/mutants-3.log`, and `L3/gate-3.log`).
- The runner leaves no mode-000 path behind (modes restored before the snapshot and in `finally`).

## Known gaps

- On base, unchanged: variables nested deeper than 128 succeed in TS and fail natively (`MaxDepth: 128`). Not in this round's scope.
- Error mapping still reads Go's error text (`platformKind`); a typed errno from std `fs` would be a neutral std unit (verifier's prior-art note).
