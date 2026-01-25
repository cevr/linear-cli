import { Command } from "@effect/cli";
import { Console, Effect } from "effect";
import { ConfigService } from "../services/Config.js";
import { LinearService } from "../services/Linear.js";
import { BrowserService } from "../services/Browser.js";
import { StdinService } from "../services/Stdin.js";

const LINEAR_API_KEY_URL = "https://linear.app/settings/account/security";

// linear auth - Interactive authentication flow
export const authCommand = Command.make("auth", {}, () =>
  Effect.gen(function* () {
    const browser = yield* BrowserService;
    const config = yield* ConfigService;
    const stdin = yield* StdinService;

    yield* Console.log(`\nTo authenticate, you'll need a Linear API key.`);
    yield* Console.log(`Opening: ${LINEAR_API_KEY_URL}\n`);

    // Open browser
    yield* browser
      .open(LINEAR_API_KEY_URL)
      .pipe(
        Effect.catchAll(() =>
          Console.log(`Could not open browser. Please visit the URL manually.`),
        ),
      );

    // Simple prompt using readline
    const token = yield* stdin.readLine("Paste your API key: ");

    // Validate token by making an API call
    yield* Console.log("\nValidating token...");

    // Save token first so LinearService can use it
    yield* config.saveToken(token);

    // Now validate with the saved token
    const linear = yield* LinearService;
    const viewer = yield* linear.getViewer.pipe(
      Effect.catchTag("InvalidTokenError", (e) =>
        Effect.gen(function* () {
          yield* Console.error(`\nError: ${e.message}`);
          yield* Console.error("Please try again with a valid API key.");
          return yield* Effect.die(e);
        }),
      ),
    );

    yield* Console.log(`\nAuthenticated as ${viewer.name} (${viewer.email})`);
  }),
);

// linear auth whoami - Show current user
export const whoamiCommand = Command.make("whoami", {}, () =>
  Effect.gen(function* () {
    const linear = yield* LinearService;
    const viewer = yield* linear.getViewer;

    yield* Console.log(`\nLogged in as:`);
    yield* Console.log(`  Name:  ${viewer.name}`);
    yield* Console.log(`  Email: ${viewer.email}`);
    yield* Console.log(`  Admin: ${viewer.admin ? "Yes" : "No"}`);
    if (viewer.statusLabel) {
      yield* Console.log(`  Status: ${viewer.statusEmoji ?? ""} ${viewer.statusLabel}`);
    }
  }),
);

// Combined auth command with subcommands
export const auth = authCommand.pipe(Command.withSubcommands([whoamiCommand]));
