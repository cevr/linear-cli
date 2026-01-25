import { Command } from "@effect/cli";
import { Console, Effect } from "effect";
import { LinearService } from "../services/Linear.js";

// linear team list - List all teams
export const teamListCommand = Command.make("list", {}, () =>
  Effect.gen(function* () {
    const linear = yield* LinearService;
    const teams = yield* linear.getTeams;

    if (teams.length === 0) {
      yield* Console.log("No teams found.");
      return;
    }

    yield* Console.log("\nTeams:\n");

    for (const team of teams) {
      const key = team.key;
      const name = team.name;
      const description = team.description ? ` - ${team.description}` : "";
      yield* Console.log(`  ${key.padEnd(8)} ${name}${description}`);
    }

    yield* Console.log("");
  }),
);

// Combined team command with subcommands
export const team = Command.make("team", {}, () =>
  Console.log("Use 'linear team list' to list teams. See --help for more."),
).pipe(Command.withSubcommands([teamListCommand]));
