---
"@cvr/linear": patch
---

Point the typecheck script at the Effect-patched tsc binary

`typecheck` now runs `tsc --noEmit` instead of `tsgo --noEmit`. Only the `tsc`
binary of the `typescript` and `@typescript/native` packages is patched by
`effect-tsgo patch`; the `tsgo` binary ships from `@typescript/native-preview`
and is never patched, so the Effect diagnostic channel was silently inert.
`@typescript/native-preview` stays installed.

`strictEffectProvide` is set to its upstream default of `off`. The rule has no
entry-point detection, so it fires on the single legitimate `Effect.provide` at
the CLI entry point in `src/main.ts`, and `ignoreEffectWarningsInTscExitCode`
is `false`. `multipleEffectProvide` still guards chained provides.
