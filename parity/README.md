# Offline CLI parity

The public schema is pinned to the SDK 88.2.0 release commit. `schema-check.ts`
validates every bundled SDK document, plus an invalid-field negative control.
The fake executes GraphQL against that schema, not against request-name matches.

```sh
bun parity/schema-check.ts              # offline
bun parity/run.ts --record              # two fresh TS runs per case must agree
bun parity/run.ts --check-ts            # TS against the checked-in records
bun parity/run.ts --phase=1             # native parity binary, L1 cases only
bun parity/run.ts --record --seed=42     # replayable generated fixture world
```

Cases use one argument per line and record stdout, stderr, exit, resulting file
modes/digests, and semantic mutations. Only an isolated, synthetic token is used.
The runner passes a fresh HOME and cwd with no inherited API keys, proxy or
config environment. The TS preload refuses every origin except the two fixed
Linear origins and a synthetic storage origin, mapping those to loopback.
Redirects are manual, so the real service is unreachable. The native parity
entry must likewise accept only loopback origins. The shipped entry must have
no environment-based origin override.

The harness owns all children in separate process groups and stops them before
returning. A case has an output cap and a deadline only to terminate a hang.
Scratch stays under `/tmp/opencode/linear-port` for inspection until cleanup.
The Bun transpiler cache also stays there, outside the case HOME: it is a test
runtime artifact, not an application file to compare with a native binary.

Measured schema validation is not evidence that the real Linear service matches
the fixture world. Mutations are compared by operation and input, not document
shape. Request counts may differ. Tests and terminal cases for future phases
remain owned by those phases; L0 does not claim native parity.

The offline runner intentionally uses Node process/filesystem APIs and async
functions, not the application's Effect service graph. Its lint override is
limited to `parity/`: Effect-specific architecture rules do not apply. Dynamic
GraphQL resolver inputs and caught OS errors are the two explicit `any`
boundaries. The fake's public schema validates incoming GraphQL documents.

# Native read property (L2)

`bun parity/run.ts --phase=2 --property=1000` runs twelve deterministic worlds
through both programs. It compares process bytes, exits, files and mutation logs,
not a mapper shared with the port. A mismatch prints the world, arguments, both
outputs and a replay command. Worlds vary pagination, optional assignees/projects/
parents/authors, label/comment/child/relation counts, titles, limits and read flags.
The pinned public schema makes issue state and team non-null; absent state/team
cannot be valid HTTP fixture worlds, so this property does not claim those cases.

The repeated-flag case uses the approved usage-layout difference only: it checks
the command name, diagnostic reason and exit 1. Domain failure lines remain byte
equal except for the explicit q99 owner exceptions below. No blanket stderr or
JSON normalization is enabled.

## Round 2 strict regressions

Build `bin/linear-ts-parity` with `bun scripts/build.ts --parity` and the native
offline entry with the pinned compiler, then run:

```sh
bun parity/run.ts --regressions=L0 --seed=42
bun parity/run.ts --regressions=L3 --seed=42
bun parity/run.ts --regressions=L4 --seed=42
```

These use the compiled TS binary as control, with exact stdout/stderr/status,
files and mutation logs, without an exception comparator. `--trace` prints both
results; a failure prints the world, argv and replay command. L0 first checks
member/nonmember root lookups against fixture membership, independently of CLI
agreement. L3 checks all ECMAScript whitespace classes, nearby nonblank Unicode
scalars, seeded mixed strings, malformed/non-object variables and failing file
states. L4 compares accepted-origin URL canonicalization and downloads; the
foreign-origin law and every storage request's credential check stay enabled.

The fixed corpus has one explicit q99 allowlist (`owner-exceptions.ts`):
no-terminal prompt commands retain the native message and status 1 instead of
TS's prompt bytes/status 130; TOML failures retain their kind, path and status,
but use std TOML's suffix. These are owner-approved differences, not equal bytes.
The TS result is never overwritten by the native result for these exceptions.
