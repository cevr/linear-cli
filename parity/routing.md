# Local switch

`bin/linear` execs a sibling binary without changing arguments. No owner PATH
link is changed. `LINEAR_IMPL=ts` and `LINEAR_IMPL=ergo` select a binary for all
commands. An invalid value fails with status 1. Unset uses this parity table:

| Commands                                                                | Default                             |
| ----------------------------------------------------------------------- | ----------------------------------- |
| auth whoami; team list; project list                                    | Ergo (L1)                           |
| issue list/view/files                                                   | Ergo (L2, downloads L4)             |
| issue start/comment; api graphql                                        | Ergo (L3)                           |
| file download                                                           | Ergo (L4)                           |
| auth (bare); `--interactive` on any routed command                      | Ergo (L5)                           |
| --version; --help; -h                                                   | Ergo                                |
| issue create                                                            | TypeScript until config parity (L6) |
| groups; unknown commands; auth with other arguments                     | TypeScript                          |
| Any argv containing --wizard, --completions, --log-level (also = forms) | TypeScript                          |

The conservative flag scan can select TypeScript when that word is a value. It
cannot select an unported command for Ergo. A TS-only build also falls back to
TS when the native binary is absent. Explicit `LINEAR_IMPL=ergo` never falls back.
TS source and tests remain. This is not an npm/release distribution change.

Build `bun run build` for `bin/linear-ts`; build the pinned compiler, then
`ERGO=/path/to/ergo bun run build:ergo` for `bin/linear-ergo`. The compiler pin
is in `ergo-toolchain.json`. Publishing, TOML and receipts remain later steps;
no performance claim is made.
