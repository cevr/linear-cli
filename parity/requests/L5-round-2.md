ready

Protocol: supplied orchestrate worker protocol, Implementor (protocol.md/safety.md not read).
Spec: `/home/exedev/.cache/baton/wf10/cli-pilots/plan.md`, round-2 start message, q99 and L5 findings.
Head: `d7e810a3fee73b59ba4af47b13b1b465d61a7bc7` (code; request commit follows).
Base: `de8e54af02de352d4fa7bd7b8b1784b14341bdfb`.
Diff: `15 files changed, 525 insertions(+), 97 deletions(-)` (combined repair).

## Fix report and files

M1: fixed d7e810a by owner exception q99, retained as the round-2 start message directs. No prompt or exit behavior changed. `parity/declared-differences.md` cites q99 and does not claim TS byte/status equality. `owner-exceptions.ts`, `run.ts`, `README.md` provide one explicit allowlist: exact native refusal/status 1, TS status 130, empty native stdout and unchanged files/mutations. Expected TS results are not overwritten. Existing no-terminal cases/mutants are reused; no duplicate test.

## Run and receipts [measured]

Workspace `/home/exedev/Developer/personal/.worktrees/linear-ergo-r2`, branch ergo-port, compiler pin `50facc08`. Build offline controls per `parity/README.md` and L0 request; isolated HOME/private caches, umask 022, nice 19, GOMAXPROCS=1, Go -p 1.

- Gate: `sh /home/exedev/.cache/baton/wf10/cli-pilots/linear-r2-gate.sh`; `L5/gate-2.log`, final `GATE EXIT: 0`, including scripted-key CLI tests, both no-terminal mutants and all 42 product/3 harness mutants.
- Acceptance at code head: `bun parity/run.ts --phase=5 --case=view-interactive-no-terminal`; `--case=create-interactive-no-terminal`. `L5/accept-2.log`, `ACCEPT EXIT: 0`.
- No new red test: owner-approved contract exception, not a claimed parity fix. The round-1 strict mismatch remains evidence. q99 is retained under the orchestrator's explicit assumption/approval instruction; reopen if revoked.

## Limits

No real TTY/opener/token/service, live-frame claim, push, installed-link change or performance/install claim. Owned groups checked; private caches removed before READY. Untouched compiler baseline remains excluded (`RESIDUE EXIT: 1`, old CU7 prose; `CACHE COVERAGE EXIT: 0`). Supplied no-worker-scope rule followed over common.md's departure with an 8GiB kernel data-memory ceiling. Canonical: wf10 `cli-pilots/L5/round-2-request.md`.
