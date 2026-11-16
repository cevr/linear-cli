# Offline CLI parity

linear was a TypeScript CLI (Bun, Effect) until the Ergo port replaced it. The
TypeScript source is gone (owner, 2026-11-15). Its outputs were recorded before
the deletion and are the expected results here:

- `cases/<name>/`: the fixed corpus, one argument per line, with the recorded
  stdout, stderr, exit, resulting file modes and digests, and semantic
  mutations (recorded by two fresh TypeScript runs that had to agree);
- `frozen/<suite>-<seed>.json`: the property and regression cases (see
  `frozen/README.md`).

The public schema is pinned to the SDK 88.2.0 release commit. `schema-check.ts`
checks the pinned schema's digest, plus a negative control.
The fake executes GraphQL against that schema, not against request-name matches.

```sh
bun parity/schema-check.ts              # offline
bun parity/run.ts --phase=1             # native parity binary, L1 cases only
bun parity/run.ts --seed=42             # replayable generated fixture world
bun parity/run.ts --launcher            # every case through a copy of bin/linear
```

Only an isolated, synthetic token is used. The runner passes a fresh HOME and
cwd with no inherited API keys, proxy or config environment. The native parity
entry accepts only loopback origins: the two fixed Linear origins and a
synthetic storage origin map to the fake. Redirects are manual, so the real
service is unreachable. The shipped entry has no environment-based origin
override.

The harness owns all children in separate process groups and stops them before
returning. A case has an output cap and a deadline only to terminate a hang.
Scratch stays under `/tmp/opencode/linear-port` (or `LINEAR_PARITY_SCRATCH`)
for inspection until cleanup.

Measured schema validation is not evidence that the real Linear service matches
the fixture world. Mutations are compared by operation and input, not document
shape. Request counts may differ.

The offline runner uses Node process and filesystem APIs and async functions.
Dynamic GraphQL resolver inputs and caught OS errors are the two explicit `any`
boundaries. The fake's public schema validates incoming GraphQL documents.

# Native read property (L2)

`bun parity/run.ts --phase=2 --property=1000` runs twelve deterministic worlds
through the binary and compares process bytes, exits, files and mutation logs
with the recorded reference, not a mapper shared with the port. A mismatch
prints the world, arguments, both outputs and a replay command. Worlds vary
pagination, optional assignees/projects/parents/authors, label/comment/child/
relation counts, titles, limits and read flags. The pinned public schema makes
issue state and team non-null; absent state/team cannot be valid HTTP fixture
worlds, so this property does not claim those cases.

The repeated-flag case uses the approved usage-layout difference only: it checks
the command name, diagnostic reason and exit 1. Domain failure lines remain byte
equal except for the explicit q99 owner exceptions below. No blanket stderr or
JSON normalization is enabled.

## Strict regressions

```sh
bun parity/run.ts --regressions=L0 --seed=42
bun parity/run.ts --regressions=L3 --seed=42
bun parity/run.ts --regressions=L4 --seed=42
bun parity/run.ts --regressions=LUTF8 --seed=42
```

These compare exact stdout/stderr/status, files and mutation logs with the
recorded reference, without an exception comparator. `--trace` prints both
results; a failure prints the world, argv and replay command. L0 first checks
member/nonmember root lookups and every entity id a mutation input names
(`issueCreate`, `issueUpdate`, `commentCreate`, `issueArchive`) against
fixture membership, independently of CLI agreement: a missing id is Linear's
input error (`Entity not found: <Type>`, HTTP 400) and records no mutation.
L3 checks all ECMAScript whitespace classes, nearby nonblank Unicode scalars,
seeded mixed strings, malformed/non-object variables and failing file states
for each errno class the port maps (missing, not a directory, is a directory,
symlink loop, permission denied) at realPath and at readFile. L4 runs a seeded
grammar over WHATWG URL components (`upload-property.ts`): the original's
parser (Bun's `URL.parse`) decides each status, and the recorded bytes, files
and status are compared; q101 refusals are compared with the exact refusal
line. `bun parity/upload-host.ts --check` proves the generated host table
still matches that parser. The foreign-origin law and every storage request's
credential check stay enabled.

The fixed corpus has one explicit q99 allowlist (`owner-exceptions.ts`):
no-terminal prompt commands keep the native message and status 1 instead of
the original's prompt bytes and status 130; TOML failures keep their kind,
path and status, but use std TOML's suffix. These are owner-approved
differences, not equal bytes. A recorded result is never overwritten by the
native result for these exceptions.

# Error and argv properties

`bun parity/run.ts --regressions=L0 --seed=42 --trace` compares generated
HTTP-200 GraphQL error envelopes with the recorded reference: Authentication
and 401 anywhere in the SDK text, case-sensitive near misses, readable-message
overrides and the SDK's first `": {"` cut. It also runs the raw-query brace
repro and the fixture membership property (HTTP 200, error statusCode 400).

`bun parity/run.ts --regressions=LUTF8 --seed=42 --trace` passes exact invalid
UTF-8 argv bytes via the POSIX `parity/argv.py` execve adapter, then compares
titles, comment bodies and upload URLs with the recorded reference. Python is a
test adapter only; the product decoder is `ergo/cli/argv.ergo`. A failed
comparison prints the raw hex bytes and replay command. No real network or
token is used.
