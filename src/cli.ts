import { Command } from "effect/unstable/cli";
import packageJson from "../package.json" with { type: "json" };
import { api } from "./commands/api.js";
import { auth } from "./commands/auth.js";
import { issue } from "./commands/issue.js";
import { project } from "./commands/project.js";
import { team } from "./commands/team.js";

export const linear = Command.make("linear").pipe(
  Command.withDescription("Manage Linear issues, teams, projects, and authentication"),
  Command.withSubcommands([auth, team, project, issue, api]),
);

export const runCli = Command.runWith(linear, { version: packageJson.version });
