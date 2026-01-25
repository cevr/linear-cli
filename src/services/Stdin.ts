import { Context, Effect, Layer } from "effect";

/**
 * Simple stdin reading service that works with Bun compiled binaries.
 * Uses Node's readline API which Bun supports.
 */
export class StdinService extends Context.Tag("StdinService")<
  StdinService,
  {
    readonly readLine: (prompt: string) => Effect.Effect<string>;
  }
>() {
  static readonly layer = Layer.succeed(StdinService, {
    readLine: (prompt) =>
      Effect.async<string>((resume) => {
        // Use Node's readline API (Bun compatible)
        const readline = require("node:readline");
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        rl.question(prompt, (answer: string) => {
          rl.close();
          resume(Effect.succeed(answer));
        });
      }),
  });

  static readonly testLayer = (input: string) =>
    Layer.succeed(StdinService, {
      readLine: (_prompt) => Effect.succeed(input),
    });
}
