import { Console, Effect } from "effect";
import { Command } from "effect/unstable/cli";
import { jsonFlag } from "../lib/flags.js";
import { encodeJson } from "../lib/json.js";
import { LinearService } from "../services/Linear.js";

export const projectListCommand = Command.make("list", { json: jsonFlag }, ({ json }) =>
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
).pipe(
  Command.withDescription("List Linear projects"),
  Command.withExamples([
    { command: "linear project list", description: "List all projects" },
    { command: "linear project list --json", description: "List all projects as JSON" },
  ]),
);

export const project = Command.make("project", {}, () =>
  Console.log("Use 'linear project list' to list projects. See --help for more."),
).pipe(
  Command.withDescription("Manage Linear projects"),
  Command.withSubcommands([projectListCommand]),
);
