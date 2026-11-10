ready

Protocol: supplied orchestrate worker protocol, Implementor.
Spec: `/home/exedev/.cache/baton/wf10/cli-pilots/plan.md`, L3.
Head: `528c119c89c8799609148814b09554decf42faa3` (code).
Base: `8bb1b895ae9de21afad8dc8012cf4903f009a863`.
Diff: `21 files changed, 1039 insertions(+), 35 deletions(-)`.

Canonical full request: `/home/exedev/.cache/baton/wf10/cli-pilots/L3/round-1-request.md`.

## Changes by file

- `ergo/linear/write.ergo`: Workflow/Writer contracts, typed inputs/results, start planning without Writer, create machine and generated title law.
- `ergo/graphqlhttp/{client,write}.ergo`: workflow pagination, start/create/comment mutations, parent resolution and raw documents/variables.
- `ergo/graphql/{document,schema}.ergo`: pure executable/type-system GraphQL parser and generated mutation-classification property; typed syntax/Unicode/depth failures.
- `ergo/memory/write.ergo`: workflow snapshot, mutation log and raw reply provider.
- `ergo/cli/{arguments,graphql,write,issue,run}.ergo`: writes/dry runs, shared singleton-flag refusal, query/variables validation, workspace real-path containment and exact process output for the corpus.
- Both command entries bind the new providers and fs.Files. go.Foreign is explicit for the real-path check. Production origin stays fixed; parity stays loopback-only.
- `parity/{fake-linear,run}.ts` and create output records: retain a created issue for the SDK's lazy lookup and guard its identity at record time. Earlier stable `fixture` outputs were a fake bug, not the intended result.
- `parity/{corpus,mutants}.ts`, `MUTANTS.md`, `ergo/README.md`: generated writes/raw queries, causal mutants and instructions.

## Run and measured evidence

Build the pinned compiler `46cfd730` and native entries, then:

```sh
bun parity/run.ts --phase=3
bun parity/run.ts --phase=3 --property=1000
/tmp/opencode/linear-port/ergo test ergo/linear --seed 42
/tmp/opencode/linear-port/ergo test ergo/graphql --seed 42
bun parity/mutants.ts
```

- Gate: `sh /home/exedev/.cache/baton/wf10/cli-pilots/L3/gate.sh`; final line of `L3/gate-1.log`: `GATE EXIT: 0`.
- Acceptance at head: fixed/generated commands above; `L3/accept-1.log`: `ACCEPT EXIT: 0`.
- Red at L2: phase=3 comparison against unchanged L2 binary; `L3/red-1.log`: `RED EXIT: 1`.
- 61 TS-vs-record cases, 61 native fixed cases, 4 seed-42 cases and 132 generated two-program cases pass. Domain/parser/provider laws run with no skips. Mutation logs agree; dry runs log nothing.
- Seven new mutants killed: create-machine-accepts-blank-title, graphql-string-is-mutation, graphql-skips-later-operation, graphql-rejects-schema-definition, dry-run-sends-mutation, workspace-allows-symlink-escape, fake-forgets-created-issue. Seven earlier mutants remain killed. `L3/mutants-2.log`: `MUTANTS EXIT: 0`.
- Initial mutant marker/build errors were harness fixes, not flakes or weakened assertions. Both repaired create records were recorded twice and all TS phase<=3 records still compare green.
- Each process uses synthetic HOME/token, loopback transport and owned-group cleanup with ps confirmation. No live service, owner token, paid call, push or installed-CLI change.

## Known gaps and limits

Parity evidence is scoped to the corpus/generated worlds, not every memory-provider input or live API failure. Additional invalid-variable and filesystem-denial diagnostic details are untested. Only the approved GraphQL diagnostic suffix and usage layout are normalized. The parser explicitly refuses nesting above 128. Downloads, prompts, TOML, switching and receipts remain L4–L7. No compiler/Go/CI/publish change, full repository gate or speed claim.

Runs use umask 022, nice 19, GOMAXPROCS=1/-p 1, one private GOCACHE, explicit owned GOPATH/GOMODCACHE and the kernel 8 GiB data-memory ceiling. Higher-priority protocol forbids common.md 42–44's worker-created scopes. Cleanup uses the written exact-path script, Go's module-cache cleanup, then only the owned compiler worktree and scratch/private cache; the CLI clone remains. Completion is in state.md.
