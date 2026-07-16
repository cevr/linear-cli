import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { ConfigService } from "../../src/services/Config.js";

describe("ConfigService", () => {
  describe("getToken", () => {
    it.effect("returns token from test layer", () =>
      Effect.gen(function* () {
        const config = yield* ConfigService;
        const token = yield* config.getToken;
        expect(token).toBe("test-token-123");
      }).pipe(Effect.provide(ConfigService.layerTest({ token: "test-token-123" }))),
    );

    it.effect("fails with TokenNotFoundError when no token", () =>
      Effect.gen(function* () {
        const config = yield* ConfigService;
        const result = yield* config.getToken.pipe(Effect.result);
        expect(result._tag).toBe("Failure");
        if (result._tag === "Failure") {
          expect(result.failure._tag).toBe("TokenNotFoundError");
        }
      }).pipe(Effect.provide(ConfigService.layerTest())),
    );
  });

  describe("getConfig", () => {
    it.effect("returns empty config by default", () =>
      Effect.gen(function* () {
        const config = yield* ConfigService;
        const linearConfig = yield* config.getConfig;
        expect(linearConfig).toEqual({});
      }).pipe(Effect.provide(ConfigService.layerTest())),
    );

    it.effect("returns provided config", () =>
      Effect.gen(function* () {
        const config = yield* ConfigService;
        const linearConfig = yield* config.getConfig;
        expect(linearConfig.teamId).toBe("team-123");
      }).pipe(Effect.provide(ConfigService.layerTest({ config: { teamId: "team-123" } }))),
    );
  });
});
