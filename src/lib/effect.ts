import { Effect } from "effect";

export const succeedUndefined: Effect.Effect<undefined> = Effect.as(Effect.void, undefined);
