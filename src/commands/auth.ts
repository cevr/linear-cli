import { Command, Prompt } from "effect/unstable/cli";
import { ChildProcess } from "effect/unstable/process";
import { Console, Effect } from "effect";
import { jsonFlag } from "../lib/flags.js";
import { encodeJson } from "../lib/json.js";
import { LinearService } from "../services/Linear.js";

const LINEAR_API_KEY_URL = "https://linear.app/settings/account/security";

// linear auth - Interactive authentication flow
export const authCommand = Command.make("auth", {}, () =>
  Effect.gen(function* () {
    yield* Console.log(`\nTo authenticate, you'll need a Linear API key.`);
    yield* Console.log(`Opening: ${LINEAR_API_KEY_URL}\n`);

    const browserOpened = yield* Effect.gen(function* () {
      const process = yield* ChildProcess.make("open", [LINEAR_API_KEY_URL], {
        stdout: "ignore",
        stderr: "ignore",
      });
      return (yield* process.exitCode) === 0;
    }).pipe(
      Effect.scoped,
      Effect.catch(() => Effect.succeed(false)),
    );
    if (!browserOpened) {
      yield* Console.log(`Could not open browser. Please visit the URL manually.`);
    }

    const token = yield* Prompt.hidden({ message: "Paste your API key" });

    // Validate token by making an API call
    yield* Console.log("\nValidating token...");

    const linear = yield* LinearService;
    const viewer = yield* linear.authenticate(token);

    yield* Console.log(`\nAuthenticated as ${viewer.name} (${viewer.email})`);
  }),
).pipe(
  Command.withDescription("Authenticate with Linear"),
  Command.withExamples([
    { command: "linear auth", description: "Authenticate using a Linear API key" },
  ]),
);

// linear auth whoami - Show current user
export const whoamiCommand = Command.make("whoami", { json: jsonFlag }, ({ json }) =>
  Effect.gen(function* () {
    const linear = yield* LinearService;
    const viewer = yield* linear.getViewer;

    if (json) {
      yield* Console.log(
        encodeJson({
          id: viewer.id,
          name: viewer.name,
          email: viewer.email,
          admin: viewer.admin,
          status: viewer.status,
        }),
      );
      return;
    }

    yield* Console.log(`\nLogged in as:`);
    yield* Console.log(`  Name:  ${viewer.name}`);
    yield* Console.log(`  Email: ${viewer.email}`);
    yield* Console.log(`  Admin: ${viewer.admin ? "Yes" : "No"}`);
    if (viewer.status?.label !== undefined) {
      yield* Console.log(`  Status: ${viewer.status.emoji ?? ""} ${viewer.status.label}`);
    }
  }),
).pipe(
  Command.withDescription("Show the authenticated Linear user"),
  Command.withExamples([
    { command: "linear auth whoami", description: "Show the authenticated user" },
    { command: "linear auth whoami --json", description: "Show the authenticated user as JSON" },
  ]),
);

// Combined auth command with subcommands
export const auth = authCommand.pipe(Command.withSubcommands([whoamiCommand]));
