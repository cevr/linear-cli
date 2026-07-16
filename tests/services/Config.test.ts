import { describe, expect, it } from "@effect/vitest";
import { layer as BunServicesLayer } from "@effect/platform-bun/BunServices";
import { ConfigProvider, Effect, FileSystem, Path, Redacted } from "effect";
import { ConfigService } from "../../src/services/Config.js";

describe("ConfigService", () => {
  describe("getToken", () => {
    it.effect("returns token from test layer", () =>
      Effect.gen(function* () {
        const config = yield* ConfigService;
        const token = yield* config.getToken;
        expect(Redacted.value(token)).toBe("test-token-123");
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

    it.effect("loads and validates the global TOML config through Effect FileSystem", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const home = yield* fs.makeTempDirectoryScoped({ prefix: "linear-config-" });
        const configDir = path.join(home, ".config", "linear");
        yield* fs.makeDirectory(configDir, { recursive: true });
        yield* fs.writeFileString(path.join(configDir, "config.toml"), 'team_id = "ENG"\n');

        const configProvider = ConfigProvider.layer(ConfigProvider.fromUnknown({ HOME: home }));
        const config = yield* Effect.gen(function* () {
          const service = yield* ConfigService;
          return yield* service.getConfig;
        }).pipe(Effect.provide(ConfigService.layer), Effect.provide(configProvider));

        expect(config.teamId).toBe("ENG");
      }).pipe(Effect.provide(BunServicesLayer)),
    );

    it.effect("keeps file tokens redacted and gives them precedence over the environment", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const home = yield* fs.makeTempDirectoryScoped({ prefix: "linear-token-" });
        const configDir = path.join(home, ".config", "linear");
        yield* fs.makeDirectory(configDir, { recursive: true });
        yield* fs.writeFileString(path.join(configDir, "token"), "file-token\n");

        const configProvider = ConfigProvider.layer(
          ConfigProvider.fromUnknown({ HOME: home, LINEAR_API_KEY: "environment-token" }),
        );
        const token = yield* Effect.gen(function* () {
          const service = yield* ConfigService;
          return yield* service.getToken;
        }).pipe(Effect.provide(ConfigService.layer), Effect.provide(configProvider));

        expect(Redacted.value(token)).toBe("file-token");
        expect(String(token)).toBe("<redacted>");
      }).pipe(Effect.provide(BunServicesLayer)),
    );
  });
});
