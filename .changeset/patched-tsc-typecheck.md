---
"@cvr/linear": patch
---

Fix the Effect diagnostics hidden by the unpatched tsgo binary

`effect-tsgo patch` only patches the `tsc` binary of the `typescript` and
`@typescript/native` packages. The `tsgo` binary comes from
`@typescript/native-preview`, which is never patched, so `typecheck` has been
reporting zero Effect diagnostics. Running the patched `tsc` binary revealed
19 diagnostics, now fixed:

- Chained `Effect.provide` calls are merged into a single provide per site.
- `Effect.succeed(undefined)` is replaced by a shared `succeedUndefined`
  constant that keeps the `T | undefined` type required by `Schema.optional`.
- Catch-then-succeed recovery uses `Effect.orElseSucceed`.
- The finite issue priority value uses `Schema.Finite`.

The typecheck script now runs the patched `tsc` binary, so these diagnostics
are enforced from here on.
