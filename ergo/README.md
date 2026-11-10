# Native port

Compiler: `ergo-toolchain.json`. No installed command, publishing metadata or
TypeScript source is changed. The production entry has a fixed API origin;
the offline entry accepts only literal IPv4 loopback HTTP origins.

```sh
GOMAXPROCS=1 GOFLAGS=-p=1 ergo check ergo/cmd/linear
GOMAXPROCS=1 GOFLAGS=-p=1 ergo build ergo/cmd/linear -o bin/linear-ergo
GOMAXPROCS=1 GOFLAGS=-p=1 ergo build ergo/cmd/linear-parity -o bin/linear-ergo-parity
bun parity/run.ts --phase=4
bun parity/run.ts --phase=4 --property=1000
ergo test ergo/linear --seed 42
ergo test ergo/graphql --seed 42
ergo test ergo/memory --seed 42
```

`linear` declares the replaceable tracker and its law. `credential` owns token
construction and the file-before-environment rule. `graphqlhttp` implements the
tracker over a captured HTTP provider; `memory` holds snapshots. `cli` prints
the process contract. Only `cmd/` selects providers. Domain absence is an Ergo
`Option`; JSON omission is chosen only at the output boundary.

L1–L3 implement non-interactive reads, flag-driven writes and raw GraphQL. Read
planning has no Writer capability. The create machine validates team, title and
description in order. The GraphQL parser classifies operation definitions, not
words in strings or comments; it also parses type-system definitions. Nesting
above 128 is a typed syntax refusal. Query files resolve under the real working
directory after symlinks; this path check explicitly needs `go.Foreign` at the
pin, while file reads use the replaceable `fs.Files` capability. Memory writes
record domain mutations; the native parity gate exercises the HTTP provider.

L4 downloads uploads (`file download`, `issue files --download`). `linear`
declares the `Uploads` contract and the `UploadURL` brand: only `ParseUploadURL`
makes one, and each names the upload origin. `uploadhttp` reads an upload over a
std `http.Remote` that only `main` builds, under its origin and redirect policy
(production: any origin, one redirect; parity: the two loopback origins). The
token is an `http.Credential` of the upload origin, so a redirect target never
gets it. `files` chooses safe, unique names and saves under `--output-dir`.

L5 asks a person with std `prompt` on std `term`: `auth` (a secret prompt, then
`open` on the key page), and `--interactive` on `issue view`, `issue start` and
`issue create`. `linear.Sessions` checks a pasted key before
`credential.Credentials.Save` keeps it 0600 (law `SavedIsLoaded`). Interactive
create feeds the create machine in its order, each input from its flag or from
a prompt. Prompts draw on standard error; with no terminal they fail
`prompt.NotInteractive`. Only `main` binds `term.NewHost()`, `io.NewErrors()`
and `exec.NewHost()`; the parity entry binds an empty `exec.Script`, so it
never starts `open`. Tests in `cli` and `credential` play scripted keys.

Use an explicit private GOPATH/GOMODCACHE as well as GOCACHE for isolated HOME
builds. Clean a private read-only module cache with Go's `clean -modcache`, not
permission changes. TOML and installed-command linking remain L6–L7.
The local switch in `bin/linear` uses the parity table in `parity/routing.md`.
`bun run build` builds `linear-ts`, never replaces the shim; `build:ergo` builds
`linear-ergo` with the compiler from `ERGO` (or PATH). The offline gate runs the
production binary only for the origin-free `--version` smoke check.

`cli/arguments.ergo` declares one std flag command tree. Aliases are declarations
(`WithAlias`), not argv rewrites. Repeated handles preserve all occurrences and
presence; the leaf's Build refuses more than one occurrence before a service can
run. This retains singleton semantics rather than accepting std scalar last-wins.
Absent priority is an empty occurrence list, not an integer sentinel. Std help
labels these handles repeated; the CLI's singleton check remains stricter.

Effect service tags and layers are replaced by operation types and contexts;
runtime schema classes by checked records and derived codecs; tagged errors by
typed failures and a total catch. The SDK's lazy object fetches are not copied:
each read selects only its needed fields. No performance claim is made.
