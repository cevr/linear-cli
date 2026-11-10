ready

Protocol: supplied orchestrate worker protocol, Implementor (protocol.md/safety.md not read).
Spec: `/home/exedev/.cache/baton/wf10/cli-pilots/plan.md` §§3.2–3.3 and round-2 start message.
Head: `d7e810a3fee73b59ba4af47b13b1b465d61a7bc7` (code; this request commit follows).
Base: `de8e54af02de352d4fa7bd7b8b1784b14341bdfb`.
Diff: `15 files changed, 525 insertions(+), 97 deletions(-)` (combined repair).

## Fix report

M1: fixed d7e810a. Missing root values return null before SDK nested defaults; graphql-js propagates the non-null failure. Guard `fake-invents-missing-root` compares generated members/nonmembers of all seven roots against independent fixture membership. Existing seed-1002-comment also exposed commentCreate reusing a missing/old comment: it now creates and retains a real comment; guard `fake-forgets-created-comment` reuses that case. Only two successful comment records changed, each recorded twice. Missing lookups were never recorded as success. The existing issue-retention mutant now requires the exact schema null failure plus exit 1.

Files: `fake-linear.ts`, `lookup-property.ts`, `regressions.ts`, `run.ts`, `corpus.ts`, `mutants.ts`, mutant ledger/docs and two comment output records. The combined commit also repairs L3/L4 and declares q99 for L5/L6.

## Run and receipts [measured]

Workspace `/home/exedev/Developer/personal/.worktrees/linear-ergo-r2`, branch ergo-port; compiler pin unchanged at `50facc08`. Build the compiler at that pin; build controls with `bun scripts/build.ts --parity` and `ergo build ergo/cmd/linear-parity -o bin/linear-ergo-parity`. Use an isolated HOME, explicit private GOCACHE/GOPATH/GOMODCACHE, umask 022, nice 19, GOMAXPROCS=1, Go -p 1.

- Gate command: `sh /home/exedev/.cache/baton/wf10/cli-pilots/linear-r2-gate.sh`. Log `L0/gate-2.log`, final `GATE EXIT: 0`: focused format/lint/typecheck/check/test/build, schema/coverage, 81 fixed/144 generated comparisons, strict seeds 42/1000, 42 product and 3 harness mutants killed.
- Acceptance at code head: `bun parity/run.ts --record --phase=6`; `bun parity/run.ts --regressions=L0 --seed=42 --trace`. `L0/accept-2.log`, `ACCEPT EXIT: 0`. All record pairs stable, no checkout diff. A server restart interrupted api-errors; only unfinished pairs resumed at the same head. Not a flake.
- Red at base: `L0/red-2.log`, `RED EXIT: 1`; `L0/red-2-ts-binary.log`, `RED TS BINARY EXIT: 1`, records compiled TS printing fixture with status 0 against the exact base fake. Permanent guards are shared, not a private probe suite.

## Limits

No real token, live service, push, installed-link change, speed/macOS/install claim. Child groups are checked. q99 exceptions remain explicit, not strict parity. Untouched compiler residue baseline is excluded by verdicts.md (`RESIDUE EXIT: 1`, old CU7 request prose; `CACHE COVERAGE EXIT: 0`). Supplied no-worker-scope rule followed over common.md's departure, with an 8GiB kernel data-memory ceiling. Private caches removed before READY. Full canonical request: `cli-pilots/L0/round-2-request.md` in the wf10 run directory.
