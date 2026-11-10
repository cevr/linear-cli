ready

Protocol: supplied orchestrate worker protocol, Implementor.
Spec: `/home/exedev/.cache/baton/wf10/cli-pilots/plan.md`, L2.
Head: `6180f3895ed9f4e2d321071a7c7b1bda2fcb0f5a` (code).
Base: `26f44eef9810ac428289ff9d451c1db586799151`.
Diff: `16 files changed, 755 insertions(+), 18 deletions(-)`.

Canonical full request: `/home/exedev/.cache/baton/wf10/cli-pilots/L2/round-1-request.md`.

## Changes by file

- `ergo/linear/{selector,issue}.ergo`: checked private-field selectors, URL law, typed records and a read-only Reader.
- `ergo/graphqlhttp/{client,issue}.ergo`: typed wire mapping, first-page assigned issues, all-pages detail connections and per-flag loading.
- `ergo/memory/issue.ergo`: snapshot Reader.
- `ergo/cli/{run,issue}.ergo`: issue list/view/files, input-order bulk reads bounded at 4, JSON omission, UTF-16 human columns, Markdown links and typed failures.
- Both command entries bind Reader to the HTTP provider. Production origin stays fixed.
- `parity/{world,fake-linear,corpus,run}.ts`: schema-valid generated worlds and two-program read comparisons; only repeated-flag usage layout uses the approved difference.
- `parity/{MUTANTS.md,mutants.ts,README.md}`: causal guards, replay instructions, explicit private GOPATH/GOMODCACHE.

## Run and measured evidence

Build pinned Ergo `46cfd730` and both entries, then:

```sh
bun parity/run.ts --phase=2
bun parity/run.ts --phase=2 --seed=42
bun parity/run.ts --phase=2 --property=1000
/tmp/opencode/linear-port/ergo test ergo/linear --seed 42
bun parity/mutants.ts
```

- Gate: `sh /home/exedev/.cache/baton/wf10/cli-pilots/L2/gate.sh`; `L2/gate-1.log`: `GATE EXIT: 0`.
- Acceptance at head: fixed and generated parity above; `L2/accept-1.log`: `ACCEPT EXIT: 0`.
- Red at L1: phase=2 comparison against unchanged L1 binary; `L2/red-1.log`: `RED EXIT: 1`.
- 37 fixed cases, seed-42 cases and 84 generated comparisons pass; selector law passes 100 generated cases.
- New mutants killed: selector-url-loses-key (URL law), issue-connection-first-page (generated reads), read-flags-load-every-relation (view-json), bulk-view-keeps-last (three-id view). Three L1 mutants remain killed.
- Each process has synthetic HOME/token, loopback transport, owned group cleanup and ps confirmation. No owner credential/live service/paid call/push/install change.

## Known gaps

The schema forbids null issue state/team, so the HTTP property does not claim those worlds. Optional assignee/project/parent/author and empty/multi-page connections vary. Memory Reader is checked, not claimed equivalent across every provider. L3–L7 remain separate. No Ergo source, Go package or CI change; no full gate or speed claim. Domain failures remain byte exact; only repeated-flag help/usage layout differs.

Runs: umask 022, nice 19, GOMAXPROCS=1/-p 1, one private GOCACHE, explicit owned GOPATH/GOMODCACHE, kernel 8 GiB data-memory ceiling. Higher-priority protocol forbids the custom scopes requested by common.md 42–44. No load flake/retry. Scratch retained for L3 only, removed by a written exact-path script at final hand-back after go clean -modcache.
