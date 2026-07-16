import { Console, Effect } from "effect";
import { Command, Flag } from "effect/unstable/cli";
import { encodeJson } from "../lib/json.js";
import { LinearService } from "../services/Linear.js";

const jsonOption = Flag.boolean("json").pipe(
  Flag.withDescription("Emit stable JSON for scripts and agents"),
);

export const projectListCommand = Command.make("list", { json: jsonOption }, ({ json }) =>
  Effect.gen(function* () {
    const linear = yield* LinearService;
    const projects = yield* linear.getProjects;

    if (json) {
      yield* Console.log(
        encodeJson(
          projects.map((project) => ({
            id: project.id,
            name: project.name,
            slug: project.slug,
            state: project.state,
            url: project.url,
          })),
        ),
      );
      return;
    }

    if (projects.length === 0) {
      yield* Console.log("No projects found.");
      return;
    }

    yield* Console.log("\nProjects:\n");
    for (const project of projects) {
      yield* Console.log(`  ${project.name}  ${project.state}  ${project.id}`);
    }
    yield* Console.log("");
  }),
);

export const project = Command.make("project", {}, () =>
  Console.log("Use 'linear project list' to list projects. See --help for more."),
).pipe(Command.withSubcommands([projectListCommand]));
