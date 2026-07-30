import { Effect } from "effect";

/**
 * An Effect that yields absent optional data.
 *
 * Typed as `undefined` rather than `void` because these values populate
 * `Schema.optional` fields, whose encoded type is `T | undefined`.
 */
export const succeedUndefined: Effect.Effect<undefined> = Effect.as(Effect.void, undefined);
