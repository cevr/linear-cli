ready

Protocol: supplied orchestrate worker protocol, Implementor (protocol.md/safety.md not read).
Spec: `/home/exedev/.cache/baton/wf10/cli-pilots/plan.md`, round-2 start message, q99 and L6 findings.
Head: `d7e810a3fee73b59ba4af47b13b1b465d61a7bc7` (code; request commit follows).
Base: `de8e54af02de352d4fa7bd7b8b1784b14341bdfb`.
Diff: `15 files changed, 525 insertions(+), 97 deletions(-)` (combined repair).

## Fix report and files

M1: fixed d7e810a by explicit owner exception q99, retained as the round-2 message directs. No TOML/config product behavior changed. `declared-differences.md` cites q99, limited to the suffix after the config kind/path. `owner-exceptions.ts`, `run.ts`, `README.md` centralize that allowlist: exact prefixes/paths, nonempty detail, status 1, unchanged stdout/files/mutations. No expected.err = actual.err. Variable/query-file failures are never allowed. Existing cases/order law/mutants reused; no duplicate test.

## Run and receipts [measured]

Workspace `/home/exedev/Developer/personal/.worktrees/linear-ergo-r2`, branch ergo-port, compiler pin `50facc08`. Rebuild offline controls per `parity/README.md` and L0 request; isolated HOME/private caches, umask 022, nice 19, GOMAXPROCS=1, Go -p 1.

- Gate: `sh /home/exedev/.cache/baton/wf10/cli-pilots/linear-r2-gate.sh`; `L6/gate-2.log`, final `GATE EXIT: 0`. All 81 fixed/144 generated comparisons, four existing config guards and all 42 product/3 harness mutants pass.
- Acceptance at code head: `bun parity/run.ts --phase=6 --case=config-malformed`; `--case=config-invalid-type`. `L6/accept-2.log`, `ACCEPT EXIT: 0`.
- No new red test: approved contract exception, not byte-equal TOML suffixes. Round-1 strict mismatch remains evidence. q99 retained under the orchestrator's instruction; reopen if revoked.

## Limits

No real token/service, push, installed-link change or performance/macOS/install claim. Owned groups checked; private caches removed before READY. Untouched compiler baseline excluded (`RESIDUE EXIT: 1`, old CU7 prose; `CACHE COVERAGE EXIT: 0`). Supplied no-worker-scope rule followed over common.md's departure, using an 8GiB kernel data-memory ceiling. Canonical: wf10 `cli-pilots/L6/round-2-request.md`.
