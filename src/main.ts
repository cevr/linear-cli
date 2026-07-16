// @effect-diagnostics strictEffectProvide:off
import { Command } from "effect/unstable/cli";
import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Console, Effect, Layer } from "effect";
import packageJson from "../package.json" with { type: "json" };
import { linear } from "./cli.js";
import { ConfigService } from "./services/Config.js";
import { LinearService } from "./services/Linear.js";
import { BrowserService } from "./services/Browser.js";
import { StdinService } from "./services/Stdin.js";

// Build the CLI runner
const cli = Command.run(linear, { version: packageJson.version });

// Layer composition:
// - BunServices provides FileSystem, Path, Terminal, Stdio, and child processes
// - ConfigService depends on FileSystem, Path
// - LinearService depends on ConfigService
// - BrowserService is standalone

// Build layers with dependencies
const MainLayer = StdinService.layer.pipe(
  Layer.provideMerge(BrowserService.layer),
  Layer.provideMerge(LinearService.layer),
  Layer.provideMerge(ConfigService.layer),
  Layer.provideMerge(BunServices.layer),
);

// Run the CLI
cli.pipe(
  Effect.tapErrorTag("TokenNotFoundError", (e) => Console.error(`Error: ${e.message}`)),
  Effect.tapErrorTag("LinearApiError", (e) => Console.error(`Linear API Error: ${e.message}`)),
  Effect.tapErrorTag("ConfigError", (e) => Console.error(`Config Error: ${e.message}`)),
  Effect.tapErrorTag("InvalidTokenError", (e) =>
    Console.error(`Authentication Error: ${e.message}`),
  ),
  Effect.tapErrorTag("NoIssuesError", (e) => Console.error(e.message)),
  Effect.tapErrorTag("InvalidInputError", (e) => Console.error(`Invalid input: ${e.message}`)),
  Effect.provide(MainLayer),
  BunRuntime.runMain({ disableErrorReporting: true }),
);
