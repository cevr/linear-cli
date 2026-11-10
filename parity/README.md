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
