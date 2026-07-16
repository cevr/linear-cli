import { Config, Context, Effect, FileSystem, Layer, Option, Path } from "effect";
import { ConfigError, TokenNotFoundError } from "../lib/errors.js";

// Config structure for .linear.toml
export interface LinearConfig {
  readonly teamId?: string;
  readonly workspace?: string;
  readonly issueSort?: "manual" | "priority";
}

export class ConfigService extends Context.Service<
  ConfigService,
  {
    readonly getToken: Effect.Effect<string, TokenNotFoundError | ConfigError>;
    readonly saveToken: (token: string) => Effect.Effect<void, ConfigError>;
    readonly getConfig: Effect.Effect<LinearConfig, ConfigError>;
  }
>()("@cvr/linear/services/Config/ConfigService") {
  static readonly layer = Layer.effect(
    ConfigService,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;

      const homeDir = yield* Config.string("HOME").pipe(Config.withDefault(""));
      const envToken = yield* Config.string("LINEAR_API_KEY").pipe(Config.option);
      const configDir = path.join(homeDir, ".config", "linear");
      const tokenPath = path.join(configDir, "token");
      const configPath = path.join(configDir, "config.toml");

      const ensureConfigDir = Effect.gen(function* () {
        const exists = yield* fs.exists(configDir);
        if (!exists) {
          yield* fs.makeDirectory(configDir, { recursive: true });
        }
      }).pipe(
        Effect.catch((e) =>
          Effect.fail(ConfigError.make({ message: `Failed to create config directory: ${e}` })),
        ),
      );

      const getToken = Effect.gen(function* () {
        // 1. Try config file first
        const fileToken = yield* Effect.tryPromise({
          try: () => Bun.file(tokenPath).text(),
          catch: () => null,
        }).pipe(Effect.option);

        if (Option.isSome(fileToken) && fileToken.value.trim().length > 0) {
          return fileToken.value.trim();
        }

        // 2. Try env var
        if (Option.isSome(envToken)) {
          return envToken.value;
        }

        // 3. Error
        return yield* TokenNotFoundError.default;
      }).pipe(Effect.withSpan("ConfigService.getToken"));

      const saveToken = Effect.fn("ConfigService.saveToken")((token: string) =>
        Effect.gen(function* () {
          yield* ensureConfigDir;
          yield* Effect.tryPromise({
            try: () => Bun.write(tokenPath, token.trim()),
            catch: (e) => ConfigError.make({ message: `Failed to save token: ${e}` }),
          });
        }),
      );

      const getConfig = Effect.gen(function* () {
        // Try project config first (.linear.toml in cwd or git root)
        const projectConfig = yield* loadProjectConfig(path);
        if (Option.isSome(projectConfig)) {
          return projectConfig.value;
        }

        // Fall back to global config
        const globalConfig = yield* loadTomlConfig(configPath);
        return globalConfig;
      }).pipe(Effect.withSpan("ConfigService.getConfig"));

      return ConfigService.of({
        getToken,
        saveToken,
        getConfig,
      });
    }),
  );

  static readonly layerTest = (options?: { token?: string; config?: LinearConfig }) =>
    Layer.succeed(ConfigService, {
      getToken:
        options?.token != null
          ? Effect.succeed(options.token)
          : Effect.fail(TokenNotFoundError.default),
      saveToken: (_token) => Effect.void,
      getConfig: Effect.succeed(options?.config ?? {}),
    });
}

const loadTomlConfig = Effect.fn("ConfigService.loadTomlConfig")((filePath: string) =>
  Effect.tryPromise({
    try: async () => {
      const file = Bun.file(filePath);
      const exists = await file.exists();
      if (!exists) return {};

      const content = await file.text();
      // Simple TOML parsing for our use case
      let teamId: string | undefined;
      let workspace: string | undefined;
      let issueSort: "manual" | "priority" | undefined;

      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (trimmed.startsWith("#") || !trimmed.includes("=")) continue;

        const [key, ...rest] = trimmed.split("=");
        const value = rest
          .join("=")
          .trim()
          .replace(/^["']|["']$/g, "");

        switch (key?.trim()) {
          case "team_id":
            teamId = value;
            break;
          case "workspace":
            workspace = value;
            break;
          case "issue_sort":
            if (value === "manual" || value === "priority") {
              issueSort = value;
            }
            break;
        }
      }
      return { teamId, workspace, issueSort } as LinearConfig;
    },
    catch: (e) => ConfigError.make({ message: `Failed to load config: ${e}` }),
  }),
);

const loadProjectConfig = Effect.fn("ConfigService.loadProjectConfig")((pathService: Path.Path) =>
  Effect.gen(function* () {
    const cwd = process.cwd();
    const candidates = [
      pathService.join(cwd, ".linear.toml"),
      pathService.join(cwd, "linear.toml"),
    ];

    for (const candidate of candidates) {
      const exists = yield* Effect.promise(() => Bun.file(candidate).exists());
      if (exists) {
        const config = yield* loadTomlConfig(candidate);
        return Option.some(config);
      }
    }

    return Option.none();
  }),
);
