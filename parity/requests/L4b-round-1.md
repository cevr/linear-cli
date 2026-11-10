ready

Protocol: supplied orchestrate worker protocol, Implementor (protocol.md/safety.md not read).
Spec: `/home/exedev/.cache/baton/wf10/cli-pilots/plan.md`, sections 3.2 and 3.4, plus start message (CU1 migration and switch).
Head: `a9cd06169f85e75fdc6a9eabc9f03b9faaacd384` (code head).
Base: `030c3a188ba153655f5abeaf691b8d61aaf06b9b`.
Diff: `17 files changed, 469 insertions(+), 212 deletions(-)` (`git diff --stat 030c3a1..a9cd061 | tail -1`).
Workspace: linear-ergo, ergo-port, unpushed. Canonical request: `/home/exedev/.cache/baton/wf10/cli-pilots/L4b/round-1-request.md`.

## Changes

- `cli/arguments.ergo`: CU1 root/tree, singleton Build policy over declared repeated handles, typed reads.
- `cli/run.ergo`: ParseRoot, version and parsed-value dispatch.
- `cli/issue.ergo`, `files.ergo`: declared s/n/o aliases, no argv rewrite/reparse.
- `cli/write.ergo`, `graphql.ergo`: no supplied() scan or priority sentinel.
- `bin/linear`, `.gitignore`: tracked exec shim, LINEAR_IMPL override and conservative parity routes.
- `scripts/build.ts`, `package.json`: sibling TS/native outputs; no install/link operation.
- `parity/switch.ts`, `mutants.ts`, `MUTANTS.md`: switch and root-version acceptance/mutants.
- `.oxlintrc.json`: Node build adapter override; TS domain rules unchanged.
- `parity/routing.md`, `declared-differences.md`, `ergo/README.md`: routes and limits.

## Run and measured receipts

Use the compiler pinned to ec6f1be2. Run `bun run build`, `ERGO=/path/to/ergo bun run build:ergo`, then build `ergo/cmd/linear-parity` to `bin/linear-ergo-parity`.

- Gate: `sh /home/exedev/.cache/baton/wf10/cli-pilots/L4b/gate.sh`; `L4b/gate-1.log`, final run at this head: `GATE EXIT: 0`, `GATE SHELL EXIT: 0`. Tool formatting/typecheck/lint, CLI check/test, builds, switch, 71 TS records, 71 native cases, seed-42 4 cases, generated 144 comparisons, all mutants pass.
- Acceptance: `bun parity/switch.ts --mutants --native="$PWD/bin/linear-ergo"`, `bun parity/run.ts --phase=4`, and `bun parity/run.ts --phase=4 --property=1000`; `L4b/accept-1.log`: `ACCEPT EXIT: 0`, `ACCEPT SHELL EXIT: 0`.
- Red on retained L4 production binary: native root-version acceptance, `L4b/red-1.log`, `root-version-undeclared: version differs`, `RED EXIT: 1`. Base has no shim.
- New mutants: default-routes-interactive-to-ergo, config-create-routes-to-ergo, override-ignored, shim-loses-argument, root-version-undeclared; all killed. Existing parity guards CU1 semantics. No earlier test executes a shim/native root version.
- Gate run 1 failed only tooling lint; run 2 passed. Self-review corrected the root-version mutant to build the production entry, not the origin-requiring parity entry; final run 3 passes. No load flake.

## Gaps and decisions

Decided by derive-dont-sync/explicit contracts: std owns parsing; repeated handles preserve occurrences and absence, then Build enforces singleton semantics before providers run. Help labels handles repeated despite that policy. Create stays TS until config parity; prompts, unknown/group commands and Effect-only flags stay TS. No L5/L6 or performance claim. TS source/tests remain. No owner link, token, live service, publishing or Ergo code changed.

Umask 022, nice 19, GOMAXPROCS=1, Go -p 1, GOMEMLIMIT=6GiB, kernel data ceiling 8 GiB, private caches. The supplied higher-priority protocol forbids worker-created scopes despite common.md 42–44, so no scope was used. Owned processes checked after runs. Compiler/private caches retained only for the continuing O1 step and removed by the written `L4b/cleanup.ts` before final READY.
