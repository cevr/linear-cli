ready

Protocol: supplied orchestrate worker protocol, Implementor (protocol.md/safety.md not read).
Spec: orchestrator round-3 message (wf10 linear-cli fix round 3) and `L0/round-2-findings.md`; no phase spec.md exists.
Head: `215c4ed745d71a615eae1cd38ed06e43229c267d` (code; the request-mirror commit follows).
Base: `adf6112a90df85ff60add9e8d77a213c45f70884` (round 2 verified; its code is `d7e810a`).
Diff: `git diff --stat adf6112a..215c4ed | tail -1` = `15 files changed, 906 insertions(+), 76 deletions(-)` (one commit for L0, L3 and L4).
Clone: `/home/exedev/Developer/personal/.worktrees/linear-ergo`, branch `ergo-port`; compiler pin `50facc08` unchanged; no push; link unchanged.

## Fix report

- M1 (repeat of r1 M1, comment on a missing issue is fabricated success): fixed 215c4ed.
  - `parity/fake-linear.ts`: every mutation resolves each entity id it names before it records: `issueCreate`, `issueUpdate` (id and input), `commentCreate`, `issueArchive`. The modelled references are one table (`mutationReferences`: team, parent issue, project, state, assignee/subscribers, labels, comment parent). An unmodelled `*Id`/`*Ids` field fails loudly. A nonmember answers as Linear does (inferred from public reports of the API, not a live call): HTTP 400, `data: null`, error `Entity not found: <Type>` with extensions `type: "invalid input"`, `code: "INPUT_ERROR"`, `userPresentableMessage: "Could not find referenced <Type>."`. `issueUpdate` also no longer records before it resolves its state.
  - Recorded TS output against the corrected fake: `issue comment ENG-900042 --body Ready --json` → status 1, stderr `Linear API Error: Error: Entity not found: Issue - Could not find referenced Issue.` (the SDK joins the raw and the user-presentable message), no mutation, no file. `bun parity/run.ts --record --phase=6`: all 81 fixed cases re-recorded twice, no case changed (no fixed case names a missing id in a mutation).
  - `ergo/graphqlhttp/client.ergo`: the native client printed only `Error: <message>`. It now prints the SDK's `LinearError` text: the raw message capitalized and cut at its first `": {"`, then `userPresentableMessage` (else the raw message), each once, joined by `" - "`. The new CLI rows caught this.
  - Guard (property): `parity/lookup-property.ts` `checkMutationReferences` covers every id-taking mutation input in `mutationReferences` plus the `id` argument of `issueUpdate`/`issueArchive`, over three worlds per seed, with generated member ids (uuid or identifier) and nonmember ids (unknown uuid, unknown identifier, `<member>-gone`), against the fixture collections as the independent membership model. Nonmember: exactly the error above, no recorded mutation, an unchanged world. Member: accepted and recorded once. Runs before every `--regressions=L0`.
  - CLI rows (`parity/regressions.ts`): `regression-L0-comment-nonmember` (identifier) and `-uuid`, strict against the compiled TS control (status 1, equal bytes, empty mutation log).
  - Mutants (declared in `parity/MUTANTS.md` round 3, all killed by the property): `fake-comment-on-missing-issue`, `fake-archives-missing-issue`, `fake-creates-under-missing-reference`, `fake-records-before-resolving`. `fake-invents-missing-root` still killed.
- repeat M1: lookup-property.ts `checkMutationReferences` (and CLI row `regression-L0-comment-nonmember`) red at d7e810a — run at adf6112a, whose code is d7e810a: the property fails `fake-mutates-missing-reference: seed=42 field=issueCreate.teamId ... status=200 ... success:true`; the CLI row fails `TS control expected 1, got 0` (`L0/red-3.log`).

## Run

Source `../linear-r3-env.sh` (isolated HOME, private GOCACHE/GOPATH/GOMODCACHE under `/tmp/opencode/linear-r3`, GOMAXPROCS=1, `-p=1`, nice 19, umask 022, 8 GiB data limit). Compiler: `git archive 50facc08` of the Ergo repo, `go build -p 1 -o $S/ergo ./cmd/ergo`. Build: `sh ../linear-r3-build.sh`. Then `bun parity/run.ts --regressions=L0 --seed=42 [--trace]`.

## Receipts (measured)

- Gate: `sh ../linear-r3-gate.sh` → `L0/gate-3.log`, exit line `GATE EXIT: 0`. Changed-file fmt (ergo, oxfmt), tsgo strict, oxlint, schema-check, coverage, upload host table check, `ergo check`/`ergo test --seed 42` of linear, cli, graphqlhttp, uploadhttp, files; both entries; regressions L0/L3/L4 at seeds 42, 1000, 7; fixed phase 6 (81); generated property 1000 (144); full ledger, 62 mutants killed (42+3 earlier, 17 round 3).
- Acceptance at the code head: `sh ../linear-r3-accept.sh` → `L0/accept-3.log`, exit line `ACCEPT EXIT: 0` (record with no case diff; `--regressions=L0 --seed=42 --trace` in `L0/accept-3-trace.log`).
- Red at the round-2 head: `sh ../linear-r3-red.sh` → `L0/red-3.log`.
- No flake. No owned process remained after any run (`ps` checked; a `bun parity/counsel.ts` process seen once belongs to another session).

## Known gaps

- The Linear error shape is inferred from public reports, not a live call (no network, no real token by rule). HTTP 400 for an input error is also inferred.
- Lookup roots still answer graphql-js `Cannot return null for non-nullable field Query.<root>.` for a missing id; the real API answers `Entity not found`. Out of this round's scope (mutations); written as a follow-up in `../linear-r3-state.md`.
- On base, unchanged: the fake's `Issue.comments` returns every comment for every issue.
