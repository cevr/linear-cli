# @cvr/linear

## 0.5.0

### Minor Changes

- [`9e483ab`](https://github.com/cevr/linear-cli/commit/9e483ab913c4187af387888b5b0457df75859f09) Thanks [@cevr](https://github.com/cevr)! - Add `linear issue files` and `linear file download` to list and download files uploaded to Linear. The token is sent only to `uploads.linear.app` and never to a redirect target.

### Patch Changes

- [`d27ab36`](https://github.com/cevr/linear-cli/commit/d27ab3636a74564b0c4c1883912b5842035dd7d6) Thanks [@cevr](https://github.com/cevr)! - Replace ternaries with named helpers and route randomness through the Crypto service. Behavior is unchanged.

- [`a1edad8`](https://github.com/cevr/linear-cli/commit/a1edad8bc7501d639f1fad93c711eb57ba53b7d3) Thanks [@cevr](https://github.com/cevr)! - Point the typecheck script at the Effect-patched tsc binary

  `typecheck` now runs `tsc --noEmit` instead of `tsgo --noEmit`. Only the `tsc`
  binary of the `typescript` and `@typescript/native` packages is patched by
  `effect-tsgo patch`; the `tsgo` binary ships from `@typescript/native-preview`
  and is never patched, so the Effect diagnostic channel was silently inert.
  `@typescript/native-preview` stays installed.

  `strictEffectProvide` is set to its upstream default of `off`. The rule has no
  entry-point detection, so it fires on the single legitimate `Effect.provide` at
  the CLI entry point in `src/main.ts`, and `ignoreEffectWarningsInTscExitCode`
  is `false`. `multipleEffectProvide` still guards chained provides.

- [`152d9ed`](https://github.com/cevr/linear-cli/commit/152d9ed5e0ad539a947c09e602070e39e1c32b85) Thanks [@cevr](https://github.com/cevr)! - Fix the Effect diagnostics hidden by the unpatched tsgo binary

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

## 0.4.0

### Minor Changes

- [`fc24f55`](https://github.com/cevr/linear-cli/commit/fc24f55512075288b27833310b70ffd166262330) Thanks [@cevr](https://github.com/cevr)! - Harden agent workflows with explicit interactive mode, dry-run issue starts, validated issue selectors, workspace-confined GraphQL files, and complete command help examples.

## 0.3.0

### Minor Changes

- [`4476da2`](https://github.com/cevr/linear-cli/commit/4476da23053083d7ff74d1cc19dbf38d51de7b90) Thanks [@cevr](https://github.com/cevr)! - Upgrade to Effect 4 beta and TypeScript 7, add stable JSON and bulk issue reads for agents, expose comments, sub-issues, relations, and projects, support non-interactive dry-run issue creation and comments, and add an authenticated GraphQL escape hatch.

## 0.2.0

### Minor Changes

- [`371ae72`](https://github.com/cevr/linear-cli/commit/371ae72705442e5ca24a72e3041bf9ecea94473e) Thanks [@cevr](https://github.com/cevr)! - Upgrade dependencies and add linting/formatting tooling
  - Upgrade Effect ecosystem to 3.19, Linear SDK to 71, vitest to 4
  - Add oxlint, oxfmt for linting/formatting
  - Add lefthook for git hooks
  - Add gate script for CI checks
  - Apply consistent code style with semicolons
