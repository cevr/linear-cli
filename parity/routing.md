# Launcher and package

linear is one native program. The TypeScript CLI it replaced is deleted
(owner, 2026-11-15); no variable or flag selects another implementation, and
nothing falls back to one. `bin/linear` execs a sibling `bin/linear-ergo` (a
source checkout) without changing arguments, and otherwise the package binary
for the platform. No owner PATH link is changed. Effect-only global flags are
dropped (owner q95).

With the pinned compiler (`ergo-toolchain.json`), `ERGO=/path/to/ergo bun run
build` builds `bin/linear-ergo` and the offline `bin/linear-ergo-parity`.

The package (DIST2): `bun scripts/release.ts` builds `npm/<os>-<arch>/linear`
for darwin-arm64, darwin-x64, linux-arm64 and linux-x64 with the pinned
compiler, and checks each header and version line. With no `bin/linear-ergo`
beside it (the package never ships one), `bin/linear` resolves itself through
symlinks, picks `npm/<os>-<arch>/linear` by `uname -s`/`uname -m`, and refuses
any other platform by name. No postinstall step builds anything. `bun
parity/launcher.ts --mutants` checks the package layout and that the old
`LINEAR_IMPL` variable changes nothing; `bun scripts/smoke.ts` packs, installs
with bun and npm into clean homes and runs the result.
`.github/workflows/release.yml` builds on Linux and macOS runners from the pin.
Publication waits for owner approval (DIST4).

`bun parity/run.ts --launcher` copies the real launcher to scratch, with the
offline Ergo entry as its checkout sibling, and runs every case through it.
Every child has its own HOME and fixture credentials; the production native
entry keeps its fixed origins. This tests the full launcher path without
redirecting the owner's installed command or contacting Linear.
