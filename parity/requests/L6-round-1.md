ready

Protocol: supplied orchestrate worker protocol, Implementor (protocol.md/safety.md not read, as the prompt directs).
Spec: `/home/exedev/.cache/baton/wf10/cli-pilots/plan.md` section 3.3 row L6 (and 3.2), plus the start message (pin 50facc08: CU7 std toml).
Head: `9a5b1c5` (code head; the committed request mirror follows it).
Base: `f4dcfe9` (L5 request head; L5's request is `cli-pilots/L5/round-1-request.md`).
Diff: `git diff --stat f4dcfe9..9a5b1c5 | tail -1` → `17 files changed, 250 insertions(+), 35 deletions(-)` (measured).
Workspace: `/home/exedev/Developer/personal/.worktrees/linear-ergo`, branch `ergo-port`, unpushed. `~/.bun/bin/linear` is unchanged.

## What changed, by file

- `ergo/linear/config.ergo` (new): `Defaults { TeamId Option[string] }` and the operation type `Settings { Defaults() fails credential.ConfigError }`.
- `ergo/tomlconfig/config.ergo` (new): provider `File{files, cwd, home}`. `Candidates`: `cwd/.linear.toml`, `cwd/linear.toml`, `home/.config/linear/config.toml`; the first file that is there counts (NotFound goes on; Denied/Failed is `Failed to read PATH`). Decodes `Form { Team_id json.Optional[string] }` with `toml.Decode(json.Codec[Form]…)`: `toml.Malformed` → `Failed to parse PATH: line L, key K: reason`; a wire shape failure → `Invalid Linear config in PATH: expected a string at team_id`.
- `ergo/tomlconfig/config_test.ergo` (new): law `ProjectFileFirst(project, local, global bool)` over `fstest` memory, with the order written in the law (not read from `Candidates`); the runner proves all 8 cases.
- `ergo/memory/config.ergo` (new): `Settings` snapshot for tests.
- `ergo/cli/write.ergo`: `planCreate` reads `linear.Settings.Defaults()` after the `--title` check and before the teams (the original's order); `draft` takes the configured team when `--team` is absent (flag first, then config, then the only team, then a prompt when asking).
- `ergo/cli/run.ergo`, `interactive_test.ergo`: `linear.Settings` in the rows and the test context.
- `ergo/cmd/linear/main.ergo`, `ergo/cmd/linear-parity/main.ergo`: bind `tomlconfig.New(disk, cwd, home)`; `cwd` is Go's `filepath.Abs(".")` (std os has no working directory; gap G-L6-2).
- `parity/run.ts`: `config-malformed` and `config-invalid-type` compare the prefix `Config Error: Failed to parse $CASE/.linear.toml: ` / `Config Error: Invalid Linear config in $CASE/.linear.toml: ` on both sides, a non-empty detail, and the rest of the record byte for byte (status, stdout, files, mutations).
- `bin/linear`, `parity/switch.ts`, `parity/routing.md`: `issue create` routes to Ergo; switch mutant `create-routes-to-ts` replaces `config-create-routes-to-ergo`.
- `parity/mutants.ts`, `MUTANTS.md`, `declared-differences.md`, `ergo/README.md`.

The five config cases were recorded from TS at L0 (phase 6) and are unchanged.

## Run

```sh
S=/tmp/opencode/linear-l5   # compiler built from 50facc08 at $S/ergo
$S/ergo test ergo/tomlconfig --seed 42
$S/ergo build ergo/cmd/linear-parity -o bin/linear-ergo-parity
LINEAR_PARITY_SCRATCH=$S bun parity/run.ts --phase=6
LINEAR_PARITY_SCRATCH=$S bun parity/mutants.ts
```

## Evidence (measured)

- Round gate: `sh L5/gate.sh 6` → `L6/gate-1.log`. Run 2 ends `GATE EXIT: 0`, `GATE SHELL EXIT: 0`: fmt, oxfmt, tsgo, oxlint, every Ergo package (tomlconfig included) checked and tested, both builds, switch (5 mutants), `--check-ts` 81, native 81, seed-42 4, generated 144, 37 product mutants and the fake mutant killed. Run 1 failed only on `ergo fmt --check` of `memory/config.ergo` (tooling, fixed).
- Acceptance at code head: `sh L5/accept.sh 6 tomlconfig cli credential` → `L6/accept-1.log`: law `ProjectFileFirst` proved (8 cases), the L5 scripted-key tests, `parity/run.ts --phase=6` `EXIT: 0 (81 cases)`; `ACCEPT EXIT: 0`, `ACCEPT SHELL EXIT: 0`.
- Red at base: `sh L5/red.sh f4dcfe9 6 <5 config cases>` → `L6/red-1.log`: all 5 fail on the L5 binary (`--team is required when multiple teams exist`; the two failure cases lose their kind/path), `RED EXIT: 1`.
- Mutants (named before the law and cases ran; all killed): `config-global-first` and `config-skips-linear-toml` (law ProjectFileFirst; the first form of the law read the order from `Candidates` and let `config-skips-linear-toml` survive, so the law now states the order itself), `config-ignored-by-create` (case config-global), `config-error-swallowed` (case config-malformed), switch `create-routes-to-ts`.
- Processes: `/tmp/opencode/linear-l5/x` bounded scope (common.md memory rule, Departs-from line), nice 19, GOMAXPROCS=1, Go -p 1, GOMEMLIMIT=6GiB, umask 022. `ps` after each run: none of mine left.

## Decisions

- Port-local TOML parsing: none; std `toml` (CU7) only.
- The key `team_id` maps to a field `Team_id` (derived names lower only leading capitals; gap G-L6-1). Decided by smallest reversible change; a wire-name rule is an Ergo unit.
- Config is read before the teams, so a bad file fails even with `--team`, as the original does.
- Failure detail after the path is the port's; declared in `declared-differences.md`.

## Known gaps

- G-L6-1 (wire names) and G-L6-2 (no working directory in std os) are in `cli-pilots/ergo-gaps.md` (neutral).
- Config feeds only `issue create`, as in the original. No macOS run, no performance claim.
