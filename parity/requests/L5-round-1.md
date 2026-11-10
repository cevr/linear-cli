ready

Protocol: supplied orchestrate worker protocol, Implementor (protocol.md/safety.md not read, as the prompt directs).
Spec: `/home/exedev/.cache/baton/wf10/cli-pilots/plan.md` section 3.3 row L5 (and 3.2), plus the start message (re-pin to 50facc08, scripted keys and scripted terminal only).
Head: `c2e4c1b` (code head; the committed request mirror follows it).
Base: `b7b4420` (L4b request head). Re-pin commit: `deaf323`.
Diff: `git diff --stat b7b4420..c2e4c1b | tail -1` → `69 files changed, 746 insertions(+), 83 deletions(-)` (measured; 45 of the files are the five recorded cases).
Workspace: `/home/exedev/Developer/personal/.worktrees/linear-ergo`, branch `ergo-port`, unpushed. `~/.bun/bin/linear` is unchanged.

## Step 1: re-pin (deaf323)

- `ergo-toolchain.json` pins `50facc08` (CU2 term, CU3 prompt, CU7 toml on CU5/CU1).
- `parity/run.ts`, `mutants.ts`, `switch.ts`: the scratch folder is `LINEAR_PARITY_SCRATCH` (default unchanged), so this step uses its own `/tmp/opencode/linear-l5`; `/tmp/opencode/linear-port` belongs to another live session and was not touched.
- Measured: `L5/repin-2.log` ends `GATE EXIT: 0`, `REPIN EXIT: 0`: phase 4, 71 TS records, 71 native cases, 4 seed-42, 144 generated comparisons, all 21 product mutants, 5 switch mutants and the fake mutant killed. All earlier phases pass on the new pin with no source change. `repin-1.log` failed only because `mutants.ts` did not pass the scratch override to its child `run.ts`; fixed in the same commit.

## Step 2: L5 (c2e4c1b), by file

- `ergo/credential/token.ergo`: `Credentials` gains `Save(t Token) fails ConfigError` and law `SavedIsLoaded` (a saved token is the next Load, whatever the environment). `FromSecret` trims a typed key; empty is `NoToken`. `File` holds `fs.Writes`; Save makes the folder and writes the token `fs.Private()` (0600).
- `ergo/credential/token_test.ergo`: generator writes and reads one memory; test `SavedTokenIsOwnerOnly`.
- `ergo/linear/session.ergo` (new): operation type `Sessions { Verify(token) Viewer }`; failure `NoIssues`; `Candidates` (non-empty, first 20).
- `ergo/linear/write.ergo`: `Feed` steps the create machine by one input.
- `ergo/graphqlhttp/client.ergo`: `send` takes the token; `Verify` reads the viewer with a given token; `viewerOf` shared.
- `ergo/cli/interactive.ergo` (new): `--interactive` flag; `pickIssue` (started, else unstarted, 50 fetched, 20 offered, `ID: title - state`); `chooseTeam`; `authenticate` (intro, `open` through `exec.Runner`, `prompt.Secret`, Verify, then Save, then the result line).
- `ergo/cli/write.ergo`: `draft` feeds the create machine in order (team, title, description), each from its flag, else a prompt when asking (no `--title` and `--interactive`), else the typed failure. `start` picks an issue when no id and `--interactive`.
- `ergo/cli/issue.ergo`: `view` picks an issue when no id and `--interactive`.
- `ergo/cli/run.ergo`: bare `auth` runs `authenticate`; `invocation` and `dispatch` split from `run` so tests run every command but `api graphql` (the one foreign Go call) over memory providers; `Run` maps `NoIssues`, `NotInteractive`, `Cancelled`, `io.ReadFailed` to status 1.
- `ergo/cli/arguments.ergo`: `--interactive` on view, start, create.
- `ergo/cmd/linear/main.ergo`: binds `term.NewHost()`, `io.NewErrors()`, `exec.NewHost()`, `linear.Sessions`, `credential.Credentials`. `ergo/cmd/linear-parity/main.ergo`: same, but `exec.Script{}` (empty), so the offline entry never starts `open`.
- `ergo/cli/interactive_test.ergo` (new): four scripted-key tests on `term.NewScript`, prompts recorded on `io.NewRecorder()`; auth runs the real `graphqlhttp` client over `http.InMemory`, which answers 200 only for the expected `Authorization`.
- `parity/corpus.ts`, `parity/cases/*` (5 new phase-5 cases, recorded twice from TS, byte-stable): `view-interactive-id`, `start-interactive-id`, `create-interactive-title` (byte parity), `view-interactive-no-terminal`, `create-interactive-no-terminal` (declared compare).
- `parity/run.ts`: the two no-terminal cases: TS must exit 130 (it reads keys from the closed pipe and quits as an interrupt, prompt frames on stdout); the port must exit 1, stdout empty, stderr exactly `Invalid input: prompts need a terminal on standard input`, no mutation.
- `bin/linear`, `parity/switch.ts`, `parity/routing.md`: `--interactive` no longer forces TS; bare `auth` routes to Ergo; `auth --help` and create stay TS.
- `parity/mutants.ts` (`--only=` added for one mutant), `MUTANTS.md`, `declared-differences.md`, `ergo/README.md`.

## Run

```sh
S=/tmp/opencode/linear-l5   # compiler built from 50facc08 at $S/ergo
LINEAR_PARITY_SCRATCH=$S $S/ergo test ergo/cli --seed 42
LINEAR_PARITY_SCRATCH=$S $S/ergo test ergo/credential --seed 42
$S/ergo build ergo/cmd/linear-parity -o bin/linear-ergo-parity
LINEAR_PARITY_SCRATCH=$S bun parity/run.ts --phase=5
LINEAR_PARITY_SCRATCH=$S bun parity/mutants.ts
```

## Evidence (measured)

- Round gate: `sh L5/gate.sh 5` → `L5/gate-1.log`. Final run (run 3) ends `GATE EXIT: 0`, `GATE SHELL EXIT: 0`: Ergo fmt of every file, oxfmt, tsgo, oxlint, every Ergo package checked and tested (laws incl. `SavedIsLoaded` 100 cases), TS and native builds, switch (5 mutants), `--check-ts` 76, native 76, seed-42 4, generated 144, 33 product mutants and the fake mutant killed. Run 1 failed on oxfmt of `routing.md`/`switch.ts`, run 2 on oxlint `no-nested-ternary` in `run.ts`; both tooling, fixed, not flakes.
- Acceptance at code head: `sh L5/accept.sh 5 cli credential linear` → `L5/accept-1.log`: the 4 scripted-key tests, `SavedTokenIsOwnerOnly`, laws, then `parity/run.ts --phase=5` `EXIT: 0 (76 cases)`; `ACCEPT EXIT: 0`, `ACCEPT SHELL EXIT: 0`.
- Red at base: `sh L5/red.sh deaf323 5 <5 cases>` → `L5/red-1.log`: all 5 new cases fail against the base parity binary (`--interactive` is an unknown flag), `RED EXIT: 1`. The Ergo tests do not compile at base (no `pickIssue`, `authenticate`, `Sessions`).
- Mutants (named before the tests; all killed, each by the guard named): token-saved-elsewhere (law SavedIsLoaded), token-file-not-private (SavedTokenIsOwnerOnly), pick-ignores-choice and pick-offers-every-issue (ViewAsksForAnIssue), pick-skips-unstarted and pick-without-issues-prompts (StartFallsBackToUnstarted), create-never-asks-team and create-skips-description (CreateAsksInMachineOrder), auth-saves-before-verify and auth-ignores-open-status (AuthChecksBeforeKeeping), no-terminal-reported-as-cancel and view-ignores-interactive (case view-interactive-no-terminal), switch interactive-routes-to-ts and auth-routes-to-ts. auth-ignores-open-status first survived (the test covered only a missing `open`); the test now also covers a failing `open`. `default-routes-interactive-to-ergo` is retired (its rule is gone).
- Processes: every run used `/tmp/opencode/linear-l5/x` (common.md memory rule: bounded scope, per its Departs-from line over the protocol's no-own-scope rule), nice 19, GOMAXPROCS=1, Go -p 1, GOMEMLIMIT=6GiB, umask 022. `ps` after each run: no process of mine left (the remaining bun processes belong to another workspace).

## Decisions

- No pseudo-terminal case: the start message says never a real TTY; prompts are tested with CU3 machines on CU2's `term.Script`. The plan's "pty case per prompt" is replaced by the scripted-key tests plus the no-terminal process cases. Decided by the orchestrator's message.
- The TS `auth` is never recorded: it starts `open`, which is `xdg-open` on this host. Auth is checked in Ergo only.
- Prompts draw on stderr (std prompt); stdout stays clean for `--json`. Declared.
- Interactive create feeds the machine one input at a time; an invalid title stops before the description prompt (the original asks first). Decided by fail-fast; declared.
- `auth` trims the key before verifying. Declared.
- Bare `auth` is read before the flag tree (std flag gap G-L5-1). Declared.

## Known gaps

- G-L5-1 (command that runs and has subcommands) and G-L5-2 (a failure type raised only by an importing package lowers with no `Error` method; `ergo check` passes, Go build fails) are in `cli-pilots/ergo-gaps.md` (neutral). G-L5-2's workaround: package `linear` raises `NoIssues` in `Candidates`.
- No interactive byte parity: the frames are std prompt's. Status, stdout result and mutations are the claims.
- Create stays TS in the shim until L6 (config).
- No macOS run, no performance claim.
