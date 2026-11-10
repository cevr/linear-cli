ready

Protocol: supplied orchestrate worker protocol, Implementor.
Spec: `/home/exedev/.cache/baton/wf10/cli-pilots/plan.md`, L1.
Head: `48ec1a4f8d5ce8180ee0648cf6a1b8cc631d0d70` (code head).
Base: `298d8042fb3726a7ca0285067085091ac2af6b67`.
Diff: `15 files changed, 662 insertions(+), 2 deletions(-)`.

Changes: exact toolchain pin and module; typed tracker/credential contracts and
laws; memory and HTTP providers; team/project pagination and viewer status;
JSON output omission only at the output boundary; three CLI leaves and typed
failure prefixes/status 1; separate fixed-origin production and loopback-only
parity entries; generated law constructors and isolated-copy mutants.
See `ergo/README.md` and `parity/MUTANTS.md` for file-level detail.

[M] Gate: `sh /home/exedev/.cache/baton/wf10/cli-pilots/L1/gate.sh`;
`L1/gate-1.log`: `GATE EXIT: 0`. All seven Ergo packages check/test; both entries
build; 16 fixed plus 2 seeded native cases match; all three mutants are killed;
the production origin override guard and parity origin refusal pass.

[M] At-head acceptance: build `ergo/cmd/linear-parity` to
`bin/linear-ergo-parity`, then `bun parity/run.ts --phase=1` and
`bun parity/run.ts --phase=1 --seed=42`;
`L1/accept-1.log`: `ACCEPT EXIT: 0`.
[M] Red at L0 base: native source absent, `L1/red-1.log`, `EXIT: 1`.
[M] HTTP identity law red before validation: seed 42, case 12;
`L1/identity-red.log`, `EXIT: 1`. Credential, HTTP and memory laws now each pass
100 generated cases, with no skip. Mutants: empty memory identity, empty HTTP
identity, and first-page-only HTTP; `L1/mutants-1.log`, `MUTANTS EXIT: 0`.

No real API calls or owner token reads, and no installed command changes. The
production binary is built, not run. Children have owned groups and cleanup
checks. Runs use one worker, GOMAXPROCS=1/Go -p 1, nice 19, umask 022 and a kernel
8 GiB data limit. The supplied protocol forbids the custom scopes requested by
common.md lines 42–44; no custom scope is used.

Known limits: this is L1 only. L2/L3 and all later phases remain. Help/usage
layout is std flag's; filesystem denial detail is not covered by this corpus.
Domain Option avoids the pinned compiler's json.Optional generator gap (neutral
CU8); no Ergo patch. No performance claim, CI/publishing or install switch.
Full request: `/home/exedev/.cache/baton/wf10/cli-pilots/L1/round-1-request.md`.
