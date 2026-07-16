import { Command, Flag } from "effect/unstable/cli";
import { Console, Effect } from "effect";
import { encodeJson } from "../lib/json.js";
import { LinearService } from "../services/Linear.js";

const jsonOption = Flag.boolean("json").pipe(
  Flag.withDescription("Emit stable JSON for scripts and agents"),
);

// linear team list - List all teams
export const teamListCommand = Command.make("list", { json: jsonOption }, ({ json }) =>
  Effect.gen(function* () {
    const linear = yield* LinearService;
    const teams = yield* linear.getTeams;

    if (teams.length === 0) {
      yield* Console.log(json ? "[]" : "No teams found.");
      return;
    }

    if (json) {
      yield* Console.log(
        encodeJson(
          teams.map((team) => ({
            id: team.id,
            key: team.key,
            name: team.name,
            description: team.description ?? undefined,
          })),
        ),
      );
      return;
    }

    yield* Console.log("\nTeams:\n");

    for (const team of teams) {
      const key = team.key;
      const name = team.name;
      const description =
        team.description !== undefined && team.description !== null ? ` - ${team.description}` : "";
      yield* Console.log(`  ${key.padEnd(8)} ${name}${description}`);
    }

    yield* Console.log("");
  }),
);

// Combined team command with subcommands
export const team = Command.make("team", {}, () =>
  Console.log("Use 'linear team list' to list teams. See --help for more."),
).pipe(Command.withSubcommands([teamListCommand]));
