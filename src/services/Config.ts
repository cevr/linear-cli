import { parse } from "toml";
import { Config, Context, Effect, FileSystem, Layer, Option, Path, Redacted, Schema } from "effect";
import { ConfigError, TokenNotFoundError } from "../lib/errors.js";

export class LinearConfig extends Schema.Class<LinearConfig>("LinearConfig")({
  teamId: Schema.optional(Schema.String),
  workspace: Schema.optional(Schema.String),
  issueSort: Schema.optional(Schema.Literals(["manual", "priority"])),
}) {}

class LinearConfigFile extends Schema.Class<LinearConfigFile>("LinearConfigFile")({
  team_id: Schema.optional(Schema.String),
  workspace: Schema.optional(Schema.String),
  issue_sort: Schema.optional(Schema.Literals(["manual", "priority"])),
}) {}

export class ConfigService extends Context.Service<
  ConfigService,
  {
    readonly getToken: Effect.Effect<Redacted.Redacted<string>, TokenNotFoundError | ConfigError>;
    readonly saveToken: (token: Redacted.Redacted<string>) => Effect.Effect<void, ConfigError>;
    readonly getConfig: Effect.Effect<LinearConfig, ConfigError>;
  }
>()("@cvr/linear/services/Config/ConfigService") {
  static readonly layer = Layer.effect(
    ConfigService,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const homeDir = yield* Config.string("HOME").pipe(Config.withDefault(""));
      const envToken = yield* Config.redacted("LINEAR_API_KEY").pipe(Config.option);
      const configDir = path.join(homeDir, ".config", "linear");
      const tokenPath = path.join(configDir, "token");
      const configPath = path.join(configDir, "config.toml");

      const ensureConfigDir = fs
        .makeDirectory(configDir, { recursive: true })
        .pipe(
          Effect.mapError((error) =>
            ConfigError.make({ message: `Failed to create config directory: ${error}` }),
          ),
        );

      const getToken = readTokenFile(fs, tokenPath).pipe(
        Effect.flatMap(
          Option.match({
            onSome: Effect.succeed,
            onNone: () =>
              Option.match(envToken, {
                onSome: Effect.succeed,
                onNone: () => TokenNotFoundError.default,
              }),
          }),
        ),
        Effect.withSpan("ConfigService.getToken"),
      );

      const saveToken = Effect.fn("ConfigService.saveToken")(function* (
        token: Redacted.Redacted<string>,
      ) {
        yield* ensureConfigDir;
        yield* fs
          .writeFileString(tokenPath, Redacted.value(token).trim(), { mode: 0o600 })
          .pipe(
            Effect.mapError((error) =>
              ConfigError.make({ message: `Failed to save token: ${error}` }),
            ),
          );
      });

      const getConfig = Effect.gen(function* () {
        const cwd = path.resolve(".");
        for (const candidate of [path.join(cwd, ".linear.toml"), path.join(cwd, "linear.toml")]) {
          const projectConfig = yield* readConfigFile(fs, candidate);
          if (Option.isSome(projectConfig)) {
            return projectConfig.value;
          }
        }

        return Option.getOrElse(yield* readConfigFile(fs, configPath), () => new LinearConfig({}));
      }).pipe(Effect.withSpan("ConfigService.getConfig"));

      return ConfigService.of({ getToken, saveToken, getConfig });
    }),
  );

  static readonly layerTest = (options?: { token?: string; config?: LinearConfig }) =>
    Layer.succeed(ConfigService, {
      getToken:
        options?.token === undefined
          ? Effect.fail(TokenNotFoundError.default)
          : Effect.succeed(Redacted.make(options.token)),
      saveToken: () => Effect.void,
      getConfig: Effect.succeed(options?.config ?? new LinearConfig({})),
    });
}

const readTokenFile = (
  fs: Context.Service.Shape<typeof FileSystem.FileSystem>,
  tokenPath: string,
): Effect.Effect<Option.Option<Redacted.Redacted<string>>, ConfigError> =>
  fs.exists(tokenPath).pipe(
    Effect.mapError((error) =>
      ConfigError.make({ message: `Failed to inspect token file: ${error}` }),
    ),
    Effect.flatMap((exists) =>
      exists
        ? fs.readFileString(tokenPath).pipe(
            Effect.mapError((error) =>
              ConfigError.make({ message: `Failed to read token file: ${error}` }),
            ),
            Effect.map((token) => token.trim()),
            Effect.map((token) =>
              token.length === 0 ? Option.none() : Option.some(Redacted.make(token)),
            ),
          )
        : Effect.succeed(Option.none()),
    ),
  );

const readConfigFile = Effect.fn("ConfigService.readConfigFile")(function* (
  fs: Context.Service.Shape<typeof FileSystem.FileSystem>,
  filePath: string,
): Effect.fn.Return<Option.Option<LinearConfig>, ConfigError> {
  const exists = yield* fs
    .exists(filePath)
    .pipe(
      Effect.mapError((error) =>
        ConfigError.make({ message: `Failed to inspect ${filePath}: ${error}` }),
      ),
    );
  if (!exists) {
    return Option.none();
  }

  const content = yield* fs
    .readFileString(filePath)
    .pipe(
      Effect.mapError((error) =>
        ConfigError.make({ message: `Failed to read ${filePath}: ${error}` }),
      ),
    );
  const parsed = yield* Effect.try({
    try: () => parse(content),
    catch: (error) => ConfigError.make({ message: `Failed to parse ${filePath}: ${error}` }),
  });
  const decoded = yield* Schema.decodeUnknownEffect(LinearConfigFile)(parsed).pipe(
    Effect.mapError((error) =>
      ConfigError.make({ message: `Invalid Linear config in ${filePath}: ${error}` }),
    ),
  );
  return Option.some(
    new LinearConfig({
      teamId: decoded.team_id,
      workspace: decoded.workspace,
      issueSort: decoded.issue_sort,
    }),
  );
});
