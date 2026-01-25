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
      }).pipe(Effect.provide(ConfigService.testLayer({ token: "test-token-123" }))),
    );

    it.effect("fails with TokenNotFoundError when no token", () =>
      Effect.gen(function* () {
        const config = yield* ConfigService;
        const result = yield* config.getToken.pipe(Effect.either);
        expect(result._tag).toBe("Left");
        if (result._tag === "Left") {
          expect(result.left._tag).toBe("TokenNotFoundError");
        }
      }).pipe(Effect.provide(ConfigService.testLayer())),
    );
  });

  describe("getConfig", () => {
    it.effect("returns empty config by default", () =>
      Effect.gen(function* () {
        const config = yield* ConfigService;
        const linearConfig = yield* config.getConfig;
        expect(linearConfig).toEqual({});
      }).pipe(Effect.provide(ConfigService.testLayer())),
    );

    it.effect("returns provided config", () =>
      Effect.gen(function* () {
        const config = yield* ConfigService;
        const linearConfig = yield* config.getConfig;
        expect(linearConfig.teamId).toBe("team-123");
      }).pipe(Effect.provide(ConfigService.testLayer({ config: { teamId: "team-123" } }))),
    );
  });
});
