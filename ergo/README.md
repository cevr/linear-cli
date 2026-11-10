# Native port

Compiler: `ergo-toolchain.json`. No installed command, publishing metadata or
TypeScript source is changed. The production entry has a fixed API origin;
the offline entry accepts only literal IPv4 loopback HTTP origins.

```sh
GOMAXPROCS=1 GOFLAGS=-p=1 ergo check ergo/cmd/linear
GOMAXPROCS=1 GOFLAGS=-p=1 ergo build ergo/cmd/linear -o bin/linear-ergo
GOMAXPROCS=1 GOFLAGS=-p=1 ergo build ergo/cmd/linear-parity -o bin/linear-ergo-parity
bun parity/run.ts --phase=1
ergo test ergo/memory --seed 42
```

`linear` declares the replaceable tracker and its law. `credential` owns token
construction and the file-before-environment rule. `graphqlhttp` implements the
tracker over a captured HTTP provider; `memory` holds snapshots. `cli` prints
the process contract. Only `cmd/` selects providers. Domain absence is an Ergo
`Option`; JSON omission is chosen only at the output boundary.

Effect service tags and layers are replaced by operation types and contexts;
runtime schema classes by checked records and derived codecs; tagged errors by
typed failures and a total catch. The SDK's lazy object fetches are not copied:
each read selects only its needed fields. No performance claim is made.
