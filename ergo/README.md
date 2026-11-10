# Native port

Compiler: `ergo-toolchain.json`. No installed command, publishing metadata or
TypeScript source is changed. The production entry has a fixed API origin;
the offline entry accepts only literal IPv4 loopback HTTP origins.

```sh
GOMAXPROCS=1 GOFLAGS=-p=1 ergo check ergo/cmd/linear
GOMAXPROCS=1 GOFLAGS=-p=1 ergo build ergo/cmd/linear -o bin/linear-ergo
GOMAXPROCS=1 GOFLAGS=-p=1 ergo build ergo/cmd/linear-parity -o bin/linear-ergo-parity
bun parity/run.ts --phase=3
bun parity/run.ts --phase=3 --property=1000
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

Use an explicit private GOPATH/GOMODCACHE as well as GOCACHE for isolated HOME
builds. Clean a private read-only module cache with Go's `clean -modcache`, not
permission changes. Downloads, prompts, TOML and the installed-command switch
remain L4–L7. The production binary is not selected or run by the offline gate.

Effect service tags and layers are replaced by operation types and contexts;
runtime schema classes by checked records and derived codecs; tagged errors by
typed failures and a total catch. The SDK's lazy object fetches are not copied:
each read selects only its needed fields. No performance claim is made.
