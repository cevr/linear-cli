ready

Protocol: supplied orchestrate worker protocol, Implementor (protocol.md/safety.md not read).
Spec: `/home/exedev/.cache/baton/wf10/cli-pilots/plan.md`, L4 (sections 1.1, 3.2, 3.3), changed by the orchestrator's message: re-pin the compiler to `ec6f1be2` (wf10/cu5, CU1 and CU5) and use CU5 instead of the Ambient workaround.
Head: `4b18438e332587b0b54194502a6975dfa7bf9d88` (code head; the committed request mirror follows it).
Base: `ae2c9121574cfbbf042e3f4e6fe6172a77548ec5` (L3 request head).
Diff: `19 files changed, 565 insertions(+), 39 deletions(-)` (`git diff --stat ae2c9121..4b18438 | tail -1`).
Workspace: `/home/exedev/Developer/personal/.worktrees/linear-ergo`, branch `ergo-port`, not pushed.

Commits: `8531b49` build(ergo): the compiler pin moves to `ec6f1be273114f8bda42d559b0cd4083532dd88d`; `4b18438` feat(ergo): downloads.

## Changes by file

- `ergo-toolchain.json`: Ergo pin `46cfd730` → `ec6f1be2` (`8531b49`). L0–L3 were re-run on the new pin before any L4 edit.
- `ergo/linear/upload.ergo`: `UploadURL` brand (only `ParseUploadURL` makes one, so each value names `https://uploads.linear.app`), `UploadOrigin`, `UploadPath`, the `Uploads` contract, `Downloaded`, and the generated law `UploadURLKeepsOrigin`.
- `ergo/uploadhttp/upload.ergo` (new provider package): reads an upload through a captured `http.Remote`. The request is a CU5 `URLRequest`; the token goes only in `Credentials` as an `http.Credential` of the upload origin. Maps 401 to `AuthError`, a non-2xx status to `Download failed with HTTP <n> for <url>`, `OriginRefused`, `RedirectLimit` and `RequestFailed` to typed `ApiError`s.
- `ergo/credential/token.ergo`: `Bind(token, origin)` makes the token an `http.Credential` (`http.ForOrigin`). Only package `credential` reads the token text.
- `ergo/files/name.ergo` (new): `SafeName`, `UniqueName`, `DispositionName` (the original's `filename*?=` expression, then `decodeURIComponent` rules), `PreferredName` (link name, then response file name, then URL segment); laws `SafeNameStaysInOutputDir`, `UniqueNameIsFresh`.
- `ergo/files/save.ergo` (new): `Save` makes `--output-dir`, downloads in order, refuses an existing file without `--overwrite` (`Invalid input: <path> already exists. Pass --overwrite to replace it.`), writes through `fs.Writes`; typed `WriteFailed` (`File Error:`).
- `ergo/cli/files.ergo` (new), `cli/issue.ergo`, `cli/run.ergo`, `cli/arguments.ergo`: `file download URL... [--output-dir/-o] [--overwrite] [--json]`, `issue files ID --download`; JSON `{url,path,bytes,contentType?}` or `Saved <path> (<n> bytes)`; `--overwrite`/`--download` join the repeated-flag refusal. A local in `issueRead` renamed from `files` to `listed` (the package name).
- `ergo/cmd/linear/main.ergo`: `http.NewNet(http.AnyOrigin, 64 MiB body, http.Follow{MaxHops: 1})` and `uploadhttp.New(remote, linear.UploadOrigin(), "", credentials)`; binds `linear.Uploads` and `fs.Writes`. Still no environment variable moves an origin.
- `ergo/cmd/linear-parity/main.ergo`: `loopback` helper validates both `LINEAR_PARITY_ORIGIN` and `LINEAR_PARITY_STORAGE_ORIGIN` (literal IPv4 loopback only); the upload network admits only `Origins{api, storage}`; the upload origin is served at `<api>/uploads`.
- `parity/fake-linear.ts`: the upload redirect goes to the literal storage loopback origin (a second origin, so both programs cross origins); the upload origin answers 401 without the token. `parity/redirect.ts`: the preload passes that storage origin with the same no-`Authorization` check. TypeScript records are unchanged (`--check-ts --phase=4`, 71/71).
- `parity/corpus.ts`: generated `seed-N-download` (seed ≥ 1000): text or JSON, `-o files` or a new nested `--output-dir`.
- `parity/mutants.ts`, `MUTANTS.md`, `declared-differences.md`, `ergo/README.md`: L4 mutants, declared download differences, run instructions.

## How to run

```sh
cd /home/exedev/Developer/personal/.worktrees/linear-ergo
# compiler: ergo built from ec6f1be2 at /tmp/opencode/linear-port/ergo (removed at hand-back; rebuild from the pin)
ergo build ergo/cmd/linear-parity -o bin/linear-ergo-parity
bun parity/run.ts --phase=4
bun parity/run.ts --phase=4 --property=1000
ergo test ergo/linear --seed 42 && ergo test ergo/files --seed 42
bun parity/mutants.ts
```

## Evidence (measured)

- Re-pin: `L4/repin-1.log` ends `REPIN EXIT: 0`: on `ec6f1be2`, all eight L1–L3 packages check and test, both entries build, 61 fixed phase-3 cases, 4 seed-42 cases, 132 generated two-program comparisons, all 14 product/harness mutants killed.
- Round gate: `sh L4/gate.sh` in the bounded scope; `L4/gate-1.log`. Run 1 ended `GATE SHELL EXIT: 1` only because the `native-ignores-disposition` mutant did not compile (its arm no longer read `d`; S108 "read nowhere"). The mutant edit now reads `d` and returns no name; `L4/mutant-probe.ts` confirmed all four process mutants compile. Run 2 (after the labelled separator) ends `GATE EXIT: 0` and `GATE SHELL EXIT: 0`: formatting, strict harness typecheck/lint, schema and skill coverage, ten Ergo packages checked and tested (laws pass, no skip), both entries, TypeScript records 71/71, native fixed 71/71, seed-42 4/4, generated 144/144, all 22 product mutants and the harness mutant killed. Not a flake: a mutant construction fix.
- Acceptance at `4b18438`: `bun parity/run.ts --phase=4` and `--phase=4 --property=1000` after a fresh build; `L4/accept-1.log` ends `ACCEPT EXIT: 0` (71 and 144 cases).
- Red at base: the L3 code (`ae2c9121`) built with the new pin, `--phase=4 --case=download-redirect`; `L4/red-1.log` ends `RED EXIT: 1` (`Unknown command: file download`).
- Token reach: on every case the run fails if the storage listener sees `Authorization`; the fake upload origin refuses a request without the token. Both held on all 71 + 144 cases.

## New mutants (each named before its test; all killed)

| Mutant | Killed by | Why nothing else catches it |
| --- | --- | --- |
| `upload-url-host-prefix` | law `UploadURLKeepsOrigin` | The fixed foreign-host case uses an unrelated host, not `uploads.linear.app.example` |
| `safe-name-empty-fallback` | law `SafeNameStaysInOutputDir` | No fixed case has a name that cleans to nothing |
| `unique-name-no-loop` | law `UniqueNameIsFresh` | The fixed duplicate case has only two equal names |
| `native-ignores-disposition` | download-disposition cases | Declared at L0 |
| `overwrite-ignored` | download-exists case | — (existing case, now native) |
| `upload-credential-wrong-origin` | download-redirect case, with the fake's new 401 | Before the 401 rule, the fake accepted an upload without the token |
| `saved-text-drops-size` | generated `seed-1000-download` (text) | Every fixed download case prints JSON |

No port mutant can send the token to another origin: the port holds no public value of it (package `credential` alone reads it, and CU5 adds it only at its own origin). CU5's two-peer model owns that guarantee; the port's guard is the storage-header check on every case.

## Decisions

- CU5 in place of the plan's Ambient workaround (orchestrator message). `main` alone builds the `http.Remote` and chooses its policy, so `cli` and `uploadhttp` hold no `Ambient`. Decided by explicit contracts: an operation type with a captured provider, as `examples/download` in Ergo does.
- Production policy is `AnyOrigin` with `Follow{MaxHops: 1}`: the storage host is named only in the response. The original follows one redirect too. [I] The parity entry uses `Origins{api, storage}`.
- `UploadURL` is checked by hand, not with `net/url`, so `linear` needs no `go.Foreign`; it refuses what WHATWG would rewrite (declared). Decided by the simpler, reversible option.
- Body budget 64 MiB, held in memory (CU6 streaming is not built). Declared.
- Ergo's effect workarounds not taken: `Context.Service`/`Layer` → the `Uploads` operation type bound in `main`; `Schema.brand(UploadUrl)` → construction authority; `Redacted` + manual `redirect: "manual"` header discipline → a CU5 `Credential` that the transport confines; `TaggedErrorClass` → typed failures with the one total catch in `cli.Run` (`File Error:` added).
- Flags: the port-local `-o` rewrite stays, though CU1 is in the pin; moving all commands to CU1's `WithAlias`/`Repeated` is a follow-up, not L4.

## Known gaps

- Declared differences (`parity/declared-differences.md`): stricter upload URL; a second redirect reads `Download failed: more than 1 redirect for <url>` where the original names the HTTP status; a CU5 credential is re-sent on a redirect back to the upload origin itself (the original never re-sends); 64 MiB limit; transport and `File Error:` texts.
- File-system failure paths (permission denied, a directory at the target) are not in the corpus.
- L5 (prompts) waits for CU2/CU3. **L6 skipped**: no `toml` package exists at `ec6f1be2` or on any branch (CU7 not built), and the port must not hold a hand TOML parser. The five config cases stay phase 6, on TypeScript.
- No Ergo repository file changed. No performance claim.
- Runs: umask 022, nice 19, GOMAXPROCS=1, Go `-p 1`, GOMEMLIMIT=6GiB, one private GOCACHE and an owned GOPATH/GOMODCACHE under `/tmp/opencode/linear-port`, inside `systemd-run --user --scope -p MemoryMax=8G -p MemorySwapMax=0` per common.md's memory rule and its "Departs from" line (the supplied protocol forbids worker-made scopes; common.md takes precedence here by that line). The L3 gate's `ulimit -d` is kept in `gate.sh`. No owned process remains (`ps` after each run).
- Cleanup at hand-back: the compiler worktree `.worktrees/ergo-linear-tool` and `/tmp/opencode/linear-port` (GOCACHE, module cache through `go clean -modcache`) are removed by a written exact-path script; the result is in `L4/cleanup.log`.
