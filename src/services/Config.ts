import { Context, Effect, Layer, Option } from "effect"
import { FileSystem, Path } from "@effect/platform"
import { ConfigError, TokenNotFoundError } from "../lib/errors.js"

// Config structure for .linear.toml
export interface LinearConfig {
  readonly teamId?: string
  readonly workspace?: string
  readonly issueSort?: "manual" | "priority"
}

export class ConfigService extends Context.Tag("@linear/ConfigService")<
  ConfigService,
  {
    readonly getToken: Effect.Effect<string, TokenNotFoundError | ConfigError>
    readonly saveToken: (token: string) => Effect.Effect<void, ConfigError>
    readonly getConfig: Effect.Effect<LinearConfig, ConfigError>
  }
>() {
  static readonly layer = Layer.effect(
    ConfigService,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path

      const homeDir = process.env.HOME ?? ""
      const configDir = path.join(homeDir, ".config", "linear")
      const tokenPath = path.join(configDir, "token")
      const configPath = path.join(configDir, "config.toml")

      const ensureConfigDir = Effect.gen(function* () {
        const exists = yield* fs.exists(configDir)
        if (!exists) {
          yield* fs.makeDirectory(configDir, { recursive: true })
        }
      }).pipe(
        Effect.catchAll((e) =>
          ConfigError.make({ message: `Failed to create config directory: ${e}` })
        )
      )

      const getToken = Effect.gen(function* () {
        // 1. Try config file first
        const fileToken = yield* Effect.tryPromise({
          try: () => Bun.file(tokenPath).text(),
          catch: () => null,
        }).pipe(Effect.option)

        if (Option.isSome(fileToken) && fileToken.value.trim()) {
          return fileToken.value.trim()
        }

        // 2. Try env var
        const envToken = process.env.LINEAR_API_KEY
        if (envToken) {
          return envToken
        }

        // 3. Error
        return yield* TokenNotFoundError.default
      }).pipe(Effect.withSpan("ConfigService.getToken"))

      const saveToken = (token: string) =>
        Effect.gen(function* () {
          yield* ensureConfigDir
          yield* Effect.tryPromise({
            try: () => Bun.write(tokenPath, token.trim()),
            catch: (e) => ConfigError.make({ message: `Failed to save token: ${e}` }),
          })
        }).pipe(Effect.withSpan("ConfigService.saveToken"))

      const getConfig = Effect.gen(function* () {
        // Try project config first (.linear.toml in cwd or git root)
        const projectConfig = yield* loadProjectConfig(fs, path)
        if (Option.isSome(projectConfig)) {
          return projectConfig.value
        }

        // Fall back to global config
        const globalConfig = yield* loadTomlConfig(configPath)
        return globalConfig
      }).pipe(Effect.withSpan("ConfigService.getConfig"))

      return ConfigService.of({
        getToken,
        saveToken,
        getConfig,
      })
    })
  )

  static readonly testLayer = (options?: {
    token?: string
    config?: LinearConfig
  }) =>
    Layer.succeed(ConfigService, {
      getToken:
        options?.token != null
          ? Effect.succeed(options.token)
          : Effect.fail(TokenNotFoundError.default),
      saveToken: (_token) => Effect.void,
      getConfig: Effect.succeed(options?.config ?? {}),
    })
}

function loadTomlConfig(
  filePath: string
): Effect.Effect<LinearConfig, ConfigError> {
  return Effect.tryPromise({
    try: async () => {
      const file = Bun.file(filePath)
      const exists = await file.exists()
      if (!exists) return {}

      const content = await file.text()
      // Simple TOML parsing for our use case
      const config: LinearConfig = {}
      for (const line of content.split("\n")) {
        const trimmed = line.trim()
        if (trimmed.startsWith("#") || !trimmed.includes("=")) continue

        const [key, ...rest] = trimmed.split("=")
        const value = rest.join("=").trim().replace(/^["']|["']$/g, "")

        switch (key.trim()) {
          case "team_id":
            config.teamId = value
            break
          case "workspace":
            config.workspace = value
            break
          case "issue_sort":
            if (value === "manual" || value === "priority") {
              config.issueSort = value
            }
            break
        }
      }
      return config
    },
    catch: (e) => ConfigError.make({ message: `Failed to load config: ${e}` }),
  })
}

function loadProjectConfig(
  fs: FileSystem.FileSystem,
  path: Path.Path
): Effect.Effect<Option.Option<LinearConfig>, ConfigError> {
  return Effect.gen(function* () {
    const cwd = process.cwd()
    const candidates = [
      path.join(cwd, ".linear.toml"),
      path.join(cwd, "linear.toml"),
    ]

    for (const candidate of candidates) {
      const exists = yield* fs.exists(candidate)
      if (exists) {
        const config = yield* loadTomlConfig(candidate)
        return Option.some(config)
      }
    }

    return Option.none()
  })
}
