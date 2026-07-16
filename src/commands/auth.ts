import { Command, Flag } from "effect/unstable/cli";
import { Console, Effect } from "effect";
import { encodeJson } from "../lib/json.js";
import { ConfigService } from "../services/Config.js";
import { LinearService } from "../services/Linear.js";
import { BrowserService } from "../services/Browser.js";
import { StdinService } from "../services/Stdin.js";

const LINEAR_API_KEY_URL = "https://linear.app/settings/account/security";

const jsonOption = Flag.boolean("json").pipe(
  Flag.withDescription("Emit stable JSON for scripts and agents"),
);

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
        Effect.catch(() => Console.log(`Could not open browser. Please visit the URL manually.`)),
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
export const whoamiCommand = Command.make("whoami", { json: jsonOption }, ({ json }) =>
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
          status: {
            emoji: viewer.statusEmoji ?? undefined,
            label: viewer.statusLabel ?? undefined,
          },
        }),
      );
      return;
    }

    yield* Console.log(`\nLogged in as:`);
    yield* Console.log(`  Name:  ${viewer.name}`);
    yield* Console.log(`  Email: ${viewer.email}`);
    yield* Console.log(`  Admin: ${viewer.admin ? "Yes" : "No"}`);
    if (viewer.statusLabel !== undefined && viewer.statusLabel !== null) {
      yield* Console.log(`  Status: ${viewer.statusEmoji ?? ""} ${viewer.statusLabel}`);
    }
  }),
);

// Combined auth command with subcommands
export const auth = authCommand.pipe(Command.withSubcommands([whoamiCommand]));
