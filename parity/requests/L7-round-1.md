ready

Protocol: supplied orchestrate worker protocol, Implementor (protocol.md/safety.md not read, as the developer prompt directs).
Spec: `/home/exedev/.cache/baton/wf10/cli-pilots/plan.md` §3.3 L7, §3.4 and §3.5, plus the start message (counts only now; quiet-window commands deferred). No separate L7/spec.md exists.
Head: `7828db9b0a0da5ccb349d35892c2386a5efee2d1` (code head; the committed request mirror follows it).
Base: `f806abf2bfcaecbaca6ebdaec0548e603d8da9b8` (L6 request head).
Diff: `git diff --stat f806abf..7828db9 | tail -1` → `13 files changed, 449 insertions(+), 67 deletions(-)` (measured).
Workspace: `/tmp/opencode/linear-l7/repo`, independent clone, branch `ergo-port`, unpushed. Source clone remains at f806abf; installed `~/.bun/bin/linear` link is unchanged.

## Changes by file

- `bin/linear`: unset/empty LINEAR_IMPL always execs native. Remove the parity table, Effect-flag scan and implicit missing-native fallback. Explicit `ts` and `ergo`, invalid-value refusal and exact argv/status forwarding remain.
- `parity/switch.ts`, `MUTANTS.md`: default covers groups, unknown commands, unsupported flags and opaque argv; missing native must fail without TS fallback. Retire table-entry mutants; replace them with the three L7 guards below.
- `parity/run.ts`: `--target=default|ergo|ts` executes a copied real shim with compiled offline sibling binaries. Every existing case runs on each target; the production entry still has fixed origins. Direct source-reference and mutant modes remain available.
- `parity/ts-main.ts`, `scripts/build.ts`: `bun scripts/build.ts --parity` compiles a separate TS control, installing the refusing preload before the original CLI. The production TS executable is unchanged.
- `parity/receipts.ts`, `fake-linear.ts`: count-only driver; request logs, binary bytes and count-only startup strace. Identical five-issue worlds and output equality guard (help is the declared exception). Optional `--quiet` performs alternating interleaved pairs with raw samples retained. The fake accepts a benchmark-only request delay, default zero.
- `parity/receipts.md`: measured ratios and load, with no speed claim. `routing.md`, `declared-differences.md`, `ergo/README.md`, root `README.md`: unconditional default, explicit TS recovery, offline controls and local-only installation limit.
- Run-dir files: `bench-pending.md` has exact commands for §3.5; L7 has build/check/test pair jobs, cold/edit preparation and restoration, gate/accept/count scripts, receipts, raw evidence and cleanup. No publishing workflow or package metadata change.

## Run

Private compiler/cache dirs have been removed. To reproduce, recreate the compiler worktree at the unchanged pin, then:

```sh
git -C /home/exedev/Developer/personal/ergo worktree add --detach /tmp/opencode/linear-l7/compiler 50facc08f1fa8a52b35be91a5b918ebe71e73d3e
nice -n 19 sh /home/exedev/.cache/baton/wf10/cli-pilots/L7/setup.sh
nice -n 19 sh /home/exedev/.cache/baton/wf10/cli-pilots/L7/gate.sh
nice -n 19 sh /home/exedev/.cache/baton/wf10/cli-pilots/L7/accept.sh
```

For the three process targets alone, in the clone with both offline controls built: `LINEAR_PARITY_SCRATCH=/tmp/opencode/linear-l7 bun parity/run.ts --phase=6 --target=default` (repeat with ergo and ts).

## Evidence (measured)

- Round gate: `nice -n 19 sh L7/gate.sh` → `L7/gate-1.log`, final run 4: `GATE EXIT: 0`, `GATE SHELL EXIT: 0`. Changed-file format, TS typecheck/lint, shell syntax, both production/offline builds, five switch mutants, 81 fixed cases on each of default/Ergo/TS, four seed-42 cases on each target, 144 default generated comparisons, all nine native packages' laws/tests.
- Acceptance at code head: `nice -n 19 sh L7/accept.sh` → `L7/accept-1.log`, first line names 7828db9; ends `ACCEPT EXIT: 0`, `ACCEPT SHELL EXIT: 0`. All 81 cases green on each target, then switch/mutants/native-version smoke check.
- Red: new `parity/switch.ts` against the unchanged base shim → `L7/red-1.log`, `RED EXIT: 1`: the old flag scan chose TS for `auth whoami --log-level=debug`.
- Mutants: `default-still-ts`, `effect-flag-still-ts`, `missing-native-falls-back`, retained `override-ignored` and `shim-loses-argument`: all killed by the switch process seam. Earlier domain tests do not observe implementation selection. No product test seam or duplicate domain row added.
- Counts: `nice -n 19 sh L7/counts.sh` → `L7/counts-1.log`, `COUNTS EXIT: 0`, `COUNTS SHELL EXIT: 0`; raw evidence retained as `L7/counts-raw.json`. Ergo/TS ratios: executable bytes 0.09983; stripped bytes 0.06865; direct-version startup syscall count 0.27526 (single pair, scheduling-sensitive). Request ratios: teams 1.00000; view-one/all-details 0.50000; view-five/all-details 0.56604; list-limit-50 0.20000. Fresh-world outputs match. Load averages start 46.29/48.10/44.56, end 46.35/48.08/44.57. No timing or RSS sample collected.
- Runs 1–2 failed tooling only (oxlint allocator at two threads; new-code lint). Use one oxlint/Tokio thread under the memory ceiling. Run 3 passed the CLI checks, then an extra unchanged-compiler residue check failed as below. No test flake or weakened assertion.
- Share C: GOMAXPROCS=2, Go -p 2, nice 19, GOMEMLIMIT=6GiB, umask 022, one private GOCACHE and explicit GOPATH/GOMODCACHE. common.md 42–44 has a Departs-from line for worker scopes, but the higher-priority supplied protocol forbids them: no worker-created scope; kernel data-segment memory ceiling instead. Own child groups are checked with ps by each process harness; no owned process remains.
- Cleanup: written `L7/cleanup.ts`, `L7/cleanup.log` ends `CLEANUP EXIT: 0 (only repo retained; private caches absent)`, `CLEANUP SHELL EXIT: 0`. Compiler worktree removed/unregistered; private module cache cleaned by Go; scratch contains only the retained repository. Source clone and installed link unchanged.

## Dependencies and known gaps

- **T1 unmet at pin 50facc08.** `ergo version` exits 1 (`unknown command version; use ergo --help`), `L7/compiler-baseline.log`. Blocks compiler-reported version provenance, not local builds from the explicit source hash. Pin unchanged; no gap-lane re-pin requested.
- **T2 unmet.** Blocks any publish, prebuilt install-time comparison and total global-install footprint receipt. No install, publish or owner link change is attempted. The retained TS-only postinstall is not a complete native installation; documented, not advertised as shipping.
- Shared loaded host: §3.5 timing/RSS/build/check/test receipts remain pending. Exact alternating-pair commands are in `cli-pilots/bench-pending.md`, with executable jobs in L7. Counts do not establish a wall-time gain.
- Extra compiler baseline: `go test -p 2 -timeout 10m ./internal/residue` at unchanged 50facc08 fails TestContextResidue on tracked `tmp/orchestrate/wf10/cli-units/cu7/round-1-request.md:17` (wire allowlist); see gate run 3. This is not an L7 change and no compiler file is owned. Reported rather than repaired or re-pinned. The common.md cache-coverage check (`go test -p 2 -timeout 10m -run TestTestCommandsHaveCacheCoverage ./scripts/gate`) passes at that pin (`COMPILER CACHE COVERAGE EXIT: 0`).
- Existing prompt/config differences and neutral language gaps remain in their ledgers. No real TTY, owner token, live Linear service, macOS run or performance speedup claim.
