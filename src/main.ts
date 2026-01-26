// @effect-diagnostics strictEffectProvide:off
import { Command } from "@effect/cli";
import { BunContext, BunRuntime } from "@effect/platform-bun";
import { Console, Effect, Layer } from "effect";
import { auth } from "./commands/auth.js";
import { team } from "./commands/team.js";
import { issue } from "./commands/issue.js";
import { ConfigService } from "./services/Config.js";
import { LinearService } from "./services/Linear.js";
import { BrowserService } from "./services/Browser.js";
import { StdinService } from "./services/Stdin.js";

// Root command
const linear = Command.make("linear", {}, () =>
  Console.log("Linear CLI - Use --help to see available commands"),
).pipe(Command.withSubcommands([auth, team, issue]));

// Build the CLI runner
const cli = Command.run(linear, {
  name: "linear",
  version: "0.1.0",
});

// Layer composition:
// - BunContext provides FileSystem, Path, Terminal
// - ConfigService depends on FileSystem, Path
// - LinearService depends on ConfigService
// - BrowserService is standalone

// Build layers with dependencies
const MainLayer = StdinService.layer.pipe(
  Layer.provideMerge(BrowserService.layer),
  Layer.provideMerge(LinearService.layer),
  Layer.provideMerge(ConfigService.layer),
  Layer.provideMerge(BunContext.layer),
);

// Run the CLI
cli(process.argv).pipe(
  Effect.catchTag("TokenNotFoundError", (e) => Console.error(`Error: ${e.message}`)),
  Effect.catchTag("LinearApiError", (e) => Console.error(`Linear API Error: ${e.message}`)),
  Effect.catchTag("ConfigError", (e) => Console.error(`Config Error: ${e.message}`)),
  Effect.catchTag("InvalidTokenError", (e) => Console.error(`Authentication Error: ${e.message}`)),
  Effect.catchTag("NoIssuesError", (e) => Console.error(e.message)),
  Effect.provide(MainLayer),
  BunRuntime.runMain,
);
