ready

Protocol: supplied orchestrate worker protocol, Implementor (protocol.md/safety.md not read).
Spec: `/home/exedev/.cache/baton/wf10/cli-pilots/plan.md` §§3.2–3.3, round-2 start message and L3 findings.
Head: `d7e810a3fee73b59ba4af47b13b1b465d61a7bc7` (code; request commit follows).
Base: `de8e54af02de352d4fa7bd7b8b1784b14341bdfb`.
Diff: `15 files changed, 525 insertions(+), 97 deletions(-)` (combined repair).

## Fix report and files

- M1: fixed d7e810a. `ergo/linear/write.ergo` uses ECMAScript whitespace, not Go TrimSpace. Control and UTF-16 length rules stay unchanged. Guard `text-overtrims-next-line`: independent whitespace-class/nearby-scalar/seeded-string model through strict title/comment CLI comparison to compiled TS.
- M2: fixed d7e810a. `ergo/cli/graphql.ergo` retains exact SchemaError parse/kind details and PlatformError file kind/operation/path. Guards `variables-malformed-loses-schema-error`, `variables-kind-loses-schema-error`, `query-file-loses-platform-detail`: generated malformed/non-object JSON and failing workspace-file states compare exact stdout/stderr/status/files/mutations to compiled TS.
- Shared guards live in `parity/regressions.ts`, `run.ts`, `corpus.ts`, `mutants.ts`, ledger/docs. No private permanent suite. Other combined changes belong to L0/L4 and q99 declarations.

## Run and receipts [measured]

Workspace `/home/exedev/Developer/personal/.worktrees/linear-ergo-r2`, branch ergo-port; pin `50facc08` unchanged. Build offline controls per `parity/README.md` and the L0 request. Isolated HOME, explicit private caches, umask 022, nice 19, GOMAXPROCS=1, Go -p 1.

- Gate: `sh /home/exedev/.cache/baton/wf10/cli-pilots/linear-r2-gate.sh`; `L3/gate-2.log`, final `GATE EXIT: 0`. Focused changed-package checks/tests, format/lint/strict typecheck, 81 fixed/144 generated comparisons, strict seeds 42/1000 and all 42 product/3 harness mutants pass.
- Acceptance at code head: `bun parity/run.ts --regressions=L3 --seed=42 --trace`; `bun parity/run.ts --phase=3`. `L3/accept-2.log`, `ACCEPT EXIT: 0`. Strict regressions use no exception comparator; mutation/dry-run guards stay enabled.
- Base red: `L3/red-2.log`, `red-2-variables-0.log`, `red-2-variables-7.log`, `red-2-file-0.log`, each `RED EXIT: 1`, against compiled TS. No flake or weakened assertion.

## Limits

q99 never exempts raw variables/query files. Linux file states measured; no universal filesystem/macOS claim. Untouched compiler residue baseline remains excluded (`RESIDUE EXIT: 1`, old CU7 prose; `CACHE COVERAGE EXIT: 0`). No Go/compiler package change. No real token/network service, push, installed-link change or performance/install claim. Owned groups checked; private caches removed before READY. Supplied no-worker-scope rule followed over common.md's departure, using an 8GiB kernel data-memory ceiling. Canonical: wf10 `cli-pilots/L3/round-2-request.md`.
