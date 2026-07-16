import { Console, Context, Effect, Layer, Terminal } from "effect";

/**
 * Simple stdin reading service that works with Bun compiled binaries.
 * Uses Node's readline API which Bun supports.
 */
export class StdinService extends Context.Service<
  StdinService,
  {
    readonly readLine: (prompt: string) => Effect.Effect<string, Terminal.QuitError>;
  }
>()("@cvr/linear/services/Stdin/StdinService") {
  static readonly layer = Layer.effect(
    StdinService,
    Effect.gen(function* () {
      const terminal = yield* Terminal.Terminal;
      return StdinService.of({
        readLine: (prompt) => Console.log(prompt).pipe(Effect.andThen(terminal.readLine)),
      });
    }),
  );

  static readonly layerTest = (input: string) =>
    Layer.succeed(StdinService, {
      readLine: (_prompt) => Effect.succeed(input),
    });
}
