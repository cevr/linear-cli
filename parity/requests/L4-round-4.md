ready

Protocol: supplied orchestrate worker protocol, Implementor (protocol.md and safety.md not read, as instructed).
Spec: orchestrator round-4 message (wf10 linear-cli port); no phase spec.md exists. common.md, decisions.md and L0/L3/L4 round-3 findings read.
Head: `25066a6b479fd8c90bd5ec2a623714bbb36655f0` (code; request-mirror commit follows).
Base: `79dbffe251228429d509fc3029259d372d2b2d68` (round 3 verified).
Diff: `git diff --stat 79dbffe..25066a6 | tail -1` = `14 files changed, 303 insertions(+), 17 deletions(-)`.

## Changes

- `ergo/graphqlhttp/client.ergo`: apply the TS rule to the SDK-rendered error text: any `Authentication` or `401` substring yields `Authentication Error: Invalid API token`, including an errors envelope at HTTP 200. Preserve an explicitly empty readable message in the SDK join; the generated control exposed this extra gap and it is fixed, not excluded.
- `ergo/cli/argv.ergo`, `ergo/cli/run.ergo`: decode OS argv once at the CLI boundary, using UTF-8 maximal ill-formed-subsequence replacement as Bun does. Valid bytes, including encoded U+FFFD, stay unchanged. All native commands use this boundary; there is no TS route.
- `parity/fake-linear.ts`, `parity/lookup-property.ts`: not-found envelopes answer HTTP 200, separately checking extension `statusCode: 400`, no recorded mutation and unchanged fixture state. Re-recorded all 81 fixed cases from TS: no checked-in case output changed.
- `parity/regressions.ts`, `parity/corpus.ts`, `parity/run.ts`, `parity/argv.py`: generated HTTP-200 error envelopes, the verifier's raw-query brace repro, and raw execve byte inputs in titles, comment bodies and upload URLs. The Python adapter only passes exact bytes; it implements no product behavior. JS spawn cannot express raw invalid bytes because its argv API takes UTF-8-encoded JS strings. Go's argv can express them, so the port fixes decoding rather than declaring a limitation. Failed comparisons print both results, raw hex inputs and a replay command.
- `parity/mutants.ts`, `parity/MUTANTS.md`: named guards for the changed behavior and the prior surviving W1.
- `ergo/linear/upload.ergo`, `parity/declared-differences.md`: correct the `%zz` / `|` reason. This is std http's `url.Parse` / `EscapedPath` limit at pin 50facc08, not an HTTP restriction. Wire-target difference is G-L4-3, assigned to queued S-target. No new exception or claim of wire parity.
- `parity/README.md`: how to replay the new controls. External `../audit-linear.md`: complete default-route inventory; the set of default TS routes is empty, including hidden/unknown commands, help/version, completions and upgrade. `LINEAR_IMPL=ts` remains the only switch route to TS (q96).

## Fix report

There were no round-3 Blocker or Major findings, and no repeat-of finding.

- L0 T1 / W1 (first `": {"` cut survives): fixed e966573; guard `error-sdk-brace-uncut` runs `api graphql --query '{ issue(id: {a: 1}) { id } }'`. The generated error-envelope property also reaches cut/no-cut, readable absent/present/empty/equal/different.
- L0 On base auth-substring rule: fixed e966573; guards `error-authentication-unclassified`, `error-401-unclassified` compare generated error text and readable overrides with the compiled TS control.
- L0 HTTP-status fidelity: fixed e966573; guard `fake-not-found-http400`, with the existing generated membership property now requiring HTTP 200 and extension 400 separately.
- L3/L4 On base invalid UTF-8 argv: fixed e966573; guards `argv-keeps-invalid-bytes`, `argv-replaces-prefix-bytewise`. Every seed reaches illegal leads/continuations, overlong forms, surrogates, values above U+10FFFF and truncated legal prefixes, surrounded by valid multibyte text.
- L4 wrong declaration cause and U1 / `|` target normalization: declaration fixed e966573. Transport repair remains in assigned std unit S-target, per this round's instruction to keep compiler pin 50facc08 now and re-pin when it lands. No live request is permitted or made.
- L4 host-table generator strength note: no product failure was shown; the existing exhaustive host-table drift guard is unchanged, as directed by this round's scope.
- Other round-3 On base notes (deep variables, fixture comments collection, typed errno) are not part of this round's enumerated work and no new exception is claimed for them. This request does not assert full arbitrary-input parity.

## Run

Use `../linear-r4-env.sh`: isolated HOME, explicit private GOPATH/GOMODCACHE/GOCACHE, no network, GOMAXPROCS=1, Go -p=1, nice 19, umask 022. Export the compiler from `git archive 50facc08` into the owned scratch compiler directory, then run `sh ../linear-r4-build.sh`. Work only in `/home/exedev/Developer/personal/.worktrees/linear-ergo`, branch ergo-port. No extra port clone/worktree, push, installed link or production origin was changed.

common.md lines 41-45 explicitly depart from the no-worker-scope rule: all ad hoc checks used its bounded 8 GiB memory scope and no swap. All child processes are detached into owned groups; the harness checks for survivors after every case/mutant, plus ps checks after each run. No Go source/package changed in the compiler; this is the external port's focused gate, not the compiler's batch gate.

## Evidence

- TS control recorded before product edits: `L4/ts-record-4.log`, `TS RECORD EXIT: 0`; generated L0/LUTF8 at seed 42 with `--check-ts --trace`, then `--record --phase=6` (two stable TS records per fixed case).
- Red unchanged native: `sh ../linear-r4-red.sh`, `L4/red-4.log`, `BASE RED CONFIRMED: 0`; `regression-L0-error-0` and `regression-LUTF8-title-0` both have `parity mismatch` against TS. No assertion removed or flake retried.
- Focused green properties: `L4/property-4.log`, `NEW PROPERTY EXIT: 0` (47 L0 cases, 45 LUTF8 cases).
- Focused gate at head: `sh ../linear-r4-gate.sh`, `L4/gate-4.log`, `GATE EXIT: 0` / `GATE COMMAND EXIT: 0`. Changed-file fmt/lint and strict TS typecheck; `ergo check`/`test --seed 42` for cli/graphqlhttp/linear; schema and invocation coverage; strict L0/LUTF8/L4 at seeds 42/1000/7; fixed corpus; full ledger **69 mutants killed** and switch mutants (`SWITCH EXIT: 0`). The first lint pass exceeded the existing complexity cap; 25066a6 factors the argv adapter out of the runner, retaining the cap and all assertions. No flake.
- Acceptance at head: `sh ../linear-r4-accept.sh`, `L4/accept-4.log`, `ACCEPT EXIT: 0` / `ACCEPT COMMAND EXIT: 0`. Fixed corpus through the real shim on default, ergo and ts; L0/LUTF8 strict controls at seed 31337 with trace; 144 generated comparisons at seeds 1000-1011. The focused gate also ran all seven new mutants (69 total), including the verifier's exact raw-query W1.
- Cleanup: `bun ../linear-r4-cleanup.ts`, `L4/cleanup-4.log`, `CLEANUP EXIT: 0` / `CLEANUP COMMAND EXIT: 0`. Private module cache cleaned with Go; the one owned scratch/cache and exported compiler are absent. ps checks found no owned process remaining after the gate or acceptance. Compiler pin, switch and recorded fixed-case outputs are unchanged (`git diff --exit-code 79dbffe..25066a6 -- ergo-toolchain.json bin/linear parity/cases`, exit 0).

Known gap in this round's tasks: G-L4-3 transport bytes await the assigned std S-target unit; declaration is now accurate, compiler pin remains 50facc08 by instruction. No speed, live-server, publication, installation or macOS claim.
