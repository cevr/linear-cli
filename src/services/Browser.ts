import { Context, Effect, Layer } from "effect"
import { BrowserError } from "../lib/errors.js"

export class BrowserService extends Context.Tag("@linear/BrowserService")<
  BrowserService,
  {
    readonly open: (url: string) => Effect.Effect<void, BrowserError>
  }
>() {
  // macOS-only implementation using `open` command
  static readonly layer = Layer.succeed(BrowserService, {
    open: (url) =>
      Effect.tryPromise({
        try: () => Bun.$`open ${url}`.quiet(),
        catch: (e) => BrowserError.make({ message: String(e) }),
      }).pipe(Effect.asVoid),
  })

  // No-op layer for testing
  static readonly testLayer = Layer.succeed(BrowserService, {
    open: (_url) => Effect.void,
  })
}
