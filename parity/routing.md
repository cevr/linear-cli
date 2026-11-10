# Local switch

`bin/linear` execs a sibling binary without changing arguments. No owner PATH
link is changed. `LINEAR_IMPL=ts` and `LINEAR_IMPL=ergo` select a binary for all
commands. An invalid value fails with status 1. Unset always selects Ergo:
there is no parity table, flag scan or missing-binary fallback. This also applies
to groups, help, unknown commands and unsupported Effect flags. The native CLI
reports its own help/usage; use `LINEAR_IMPL=ts` to request the original behavior.
An absent native executable is a build error, not an implicit backend change.
TS source and tests remain in the repository; the npm package ships neither.

Build `bun run build` for `bin/linear-ts`; build the pinned compiler, then
`ERGO=/path/to/ergo bun run build:ergo` for `bin/linear-ergo`. The compiler pin
is in `ergo-toolchain.json`. Both binaries are needed for the local pilot.

The package (DIST2): `bun scripts/release.ts` builds `npm/<os>-<arch>/linear`
for darwin-arm64, darwin-x64, linux-arm64 and linux-x64 with the pinned
compiler, and checks each header and version line. With no `bin/linear-ergo`
beside it (the package never ships one), `bin/linear` resolves itself through
symlinks, picks `npm/<os>-<arch>/linear` by `uname -s`/`uname -m`, and refuses
any other platform by name. No postinstall step builds anything. In the
package, `LINEAR_IMPL=ts` is refused: there is no TS binary. `bun
parity/launcher.ts --mutants` checks the package layout; `bun scripts/smoke.ts`
packs, installs with bun and npm into clean homes and runs the result.
`.github/workflows/release.yml` builds on Linux and macOS runners from the pin.
Publication waits for owner approval (DIST4).

`bun scripts/build.ts --parity` builds a separate offline TS control. It bundles
the same refusing preload used by the source reference, before importing the
CLI. It never replaces the production TS executable. Build the offline Ergo
entry with `ergo build ergo/cmd/linear-parity -o bin/linear-ergo-parity`.
`bun parity/run.ts --target=default` copies the real shim to scratch, with those
two offline binaries as its siblings. Repeat with `--target=ergo` and
`--target=ts`. Every child has its own HOME and fixture credentials; the
production native entry retains its fixed origins. This tests the full shim
path without redirecting the owner's installed command or contacting Linear.
