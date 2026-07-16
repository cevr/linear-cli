import { Argument, Command, Flag, Prompt } from "effect/unstable/cli";
import { Console, Effect, Option } from "effect";
import type { IssueDetails } from "../domain/Linear.js";
import { parseIssueSelector, validateText } from "../domain/Input.js";
import { InvalidInputError, NoIssuesError } from "../lib/errors.js";
import { jsonFlag } from "../lib/flags.js";
import { encodeJson } from "../lib/json.js";
import { LinearService } from "../services/Linear.js";
import { ConfigService } from "../services/Config.js";

// Options
const stateOption = Flag.string("state").pipe(
  Flag.withAlias("s"),
  Flag.withDescription("Filter by state type (started, unstarted, backlog, etc.)"),
  Flag.optional,
);

const limitOption = Flag.integer("limit").pipe(
  Flag.withAlias("n"),
  Flag.withDefault(20),
  Flag.withDescription("Number of issues to show"),
);

const commentsOption = Flag.boolean("comments").pipe(
  Flag.withDescription("Include issue comments"),
);

const childrenOption = Flag.boolean("children").pipe(Flag.withDescription("Include sub-issues"));

const relationsOption = Flag.boolean("relations").pipe(
  Flag.withDescription("Include inbound and outbound issue relations"),
);

const titleOption = Flag.string("title").pipe(
  Flag.withDescription("Issue title; enables non-interactive creation"),
  Flag.optional,
);

const descriptionOption = Flag.string("description").pipe(
  Flag.withDescription("Issue description in Markdown"),
  Flag.optional,
);

const teamOption = Flag.string("team").pipe(
  Flag.withDescription("Team key or UUID"),
  Flag.optional,
);

const parentOption = Flag.string("parent").pipe(
  Flag.withDescription("Parent issue identifier or UUID"),
  Flag.optional,
);

const projectOption = Flag.string("project").pipe(
  Flag.withDescription("Project name, slug, or UUID"),
  Flag.optional,
);

const priorityOption = Flag.integer("priority").pipe(
  Flag.withDescription("Priority from 0 (none) to 4 (low)"),
  Flag.optional,
);

const dryRunOption = Flag.boolean("dry-run").pipe(
  Flag.withDescription("Validate and print the mutation without writing"),
);

const interactiveOption = Flag.boolean("interactive").pipe(
  Flag.withDescription("Allow prompts when required input is missing"),
);

const bodyOption = Flag.string("body").pipe(Flag.withDescription("Comment body in Markdown"));

// Args
const issueIdsArg = Argument.string("id").pipe(
  Argument.withDescription("Issue ID, URL, or identifier (repeat for bulk reads)"),
  Argument.variadic(),
);

// linear issue list - List issues
export const issueListCommand = Command.make(
  "list",
  { state: stateOption, limit: limitOption, json: jsonFlag },
  ({ state, limit, json }) =>
    Effect.gen(function* () {
      if (limit < 1 || limit > 250) {
        return yield* InvalidInputError.make({
          message: "--limit must be between 1 and 250. Example: linear issue list --limit 20",
        });
      }

      const linear = yield* LinearService;
      const stateFilter = Option.getOrUndefined(state);
      const issues = yield* linear.getMyIssues({ state: stateFilter, limit });

      if (issues.length === 0) {
        yield* Console.log(json ? "[]" : "No issues found.");
        return;
      }

      const displayed = issues.slice(0, limit);

      if (json) {
        yield* Console.log(encodeJson(displayed));
        return;
      }

      yield* Console.log("\nYour Issues:\n");
      for (const issue of displayed) {
        const stateName = issue.state?.name ?? "Unknown";
        const priorityIcon = getPriorityIcon(issue.priority.value);

        yield* Console.log(
          `  ${priorityIcon} ${issue.identifier.padEnd(10)} ${stateName.padEnd(12)} ${truncate(issue.title, 50)}`,
        );
      }

      if (issues.length > limit) {
        yield* Console.log(`\n  ... and ${issues.length - limit} more`);
      }

      yield* Console.log("");
    }),
).pipe(
  Command.withDescription("List issues assigned to the authenticated user"),
  Command.withExamples([
    { command: "linear issue list --json", description: "List assigned issues as JSON" },
    {
      command: "linear issue list --state started --limit 10 --json",
      description: "List up to ten started issues",
    },
  ]),
);

// linear issue view [id] - View issue details
export const issueViewCommand = Command.make(
  "view",
  {
    ids: issueIdsArg,
    json: jsonFlag,
    interactive: interactiveOption,
    comments: commentsOption,
    children: childrenOption,
    relations: relationsOption,
  },
  ({ ids, json, interactive, comments, children, relations }) =>
    Effect.gen(function* () {
      if (ids.length === 0 && !interactive) {
        return yield* InvalidInputError.make({
          message:
            "Issue identifier required in non-interactive mode. Usage: linear issue view ISSUE-123 --json",
        });
      }
      const selectedIds = yield* Effect.forEach(
        ids.length === 0 ? [yield* selectIssue] : ids,
        parseIssueSelector,
      );
      const linear = yield* LinearService;
      const details = yield* Effect.forEach(
        selectedIds,
        (id) => linear.getIssueDetails(id, { comments, children, relations }),
        { concurrency: 4 },
      );

      if (json) {
        yield* Console.log(encodeJson(details));
        return;
      }

      yield* Effect.forEach(details, renderIssueDetails, { discard: true });
    }),
).pipe(
  Command.withDescription("Read one or more issues"),
  Command.withExamples([
    { command: "linear issue view ENG-123 --json", description: "Read one issue as JSON" },
    {
      command: "linear issue view ENG-123 ENG-124 --comments --json",
      description: "Read several issues with comments",
    },
    { command: "linear issue view --interactive", description: "Choose an issue interactively" },
  ]),
);

// linear issue start [id] - Start working on an issue
const optionalIssueIdArg = Argument.string("id").pipe(
  Argument.withDescription("Issue ID, URL, or identifier"),
  Argument.optional,
);

export const issueStartCommand = Command.make(
  "start",
  {
    id: optionalIssueIdArg,
    dryRun: dryRunOption,
    json: jsonFlag,
    interactive: interactiveOption,
  },
  ({ id, dryRun, json, interactive }) =>
    Effect.gen(function* () {
      const selectedIssue = yield* Option.match(id, {
        onNone: () =>
          interactive
            ? selectIssue
            : InvalidInputError.make({
                message:
                  "Issue identifier required in non-interactive mode. Usage: linear issue start ISSUE-123 --dry-run",
              }),
        onSome: Effect.succeed,
      });
      const issueId = yield* parseIssueSelector(selectedIssue);

      const linear = yield* LinearService;
      const started = yield* linear.startIssue(issueId, { dryRun });
      if (dryRun) {
        yield* Console.log(
          encodeJson({
            dryRun: true,
            operation: "issue.start",
            input: { id: issueId },
            result: started,
          }),
        );
        return;
      }
      if (json) {
        yield* Console.log(encodeJson(started));
        return;
      }

      yield* Console.log(`\nStarted: ${started.issue.identifier} - ${started.issue.title}`);
      yield* Console.log(`State changed to: ${started.state.name}`);
      yield* Console.log(`\nBranch name: ${started.branchName}`);
      yield* Console.log("");
    }),
).pipe(
  Command.withDescription("Move an issue to its team's started state"),
  Command.withExamples([
    {
      command: "linear issue start ENG-123 --dry-run",
      description: "Validate and preview the state change",
    },
    {
      command: "linear issue start ENG-123 --json",
      description: "Start an issue and return the result as JSON",
    },
  ]),
);

// linear issue create - Create a new issue
export const issueCreateCommand = Command.make(
  "create",
  {
    title: titleOption,
    description: descriptionOption,
    team: teamOption,
    parent: parentOption,
    project: projectOption,
    priority: priorityOption,
    dryRun: dryRunOption,
    json: jsonFlag,
    interactive: interactiveOption,
  },
  ({ title, description, team, parent, project, priority, dryRun, json, interactive }) =>
    Effect.gen(function* () {
      if (Option.isNone(title) && !interactive) {
        return yield* InvalidInputError.make({
          message:
            '--title is required in non-interactive mode. Usage: linear issue create --team ENG --title "Title" --dry-run',
        });
      }

      const linear = yield* LinearService;
      const config = yield* ConfigService;
      const linearConfig = yield* config.getConfig;
      const teams = yield* linear.getTeams;

      if (teams.length === 0) {
        return yield* InvalidInputError.make({
          message: "No teams found; an issue cannot be created",
        });
      }

      const isInteractive = Option.isNone(title);
      const requestedTeam = Option.getOrUndefined(team) ?? linearConfig.teamId;
      const teamId = yield* resolveTeamId(teams, requestedTeam, isInteractive);
      const issueTitle = yield* Option.match(title, {
        onNone: () => Prompt.text({ message: "Issue title" }),
        onSome: Effect.succeed,
      });
      const issueDescription = yield* Option.match(description, {
        onNone: () =>
          isInteractive
            ? Prompt.text({
                message: "Description (optional, press Enter to skip)",
                default: "",
              })
            : Effect.succeed(""),
        onSome: Effect.succeed,
      });
      const validatedTitle = yield* validateText({
        name: "Issue title",
        value: issueTitle,
        maximumLength: 255,
      });
      const validatedDescription = yield* validateText({
        name: "Issue description",
        value: issueDescription,
        maximumLength: 100_000,
        allowEmpty: true,
      });
      const priorityValue = Option.getOrUndefined(priority);
      if (priorityValue !== undefined && (priorityValue < 0 || priorityValue > 4)) {
        return yield* InvalidInputError.make({ message: "--priority must be between 0 and 4" });
      }

      const projectSelector = Option.getOrUndefined(project);
      const projectId =
        projectSelector === undefined
          ? undefined
          : yield* resolveProjectId(yield* linear.getProjects, projectSelector);
      const input = {
        title: validatedTitle,
        teamId,
        description: validatedDescription.length === 0 ? undefined : validatedDescription,
        parent: yield* Option.match(parent, {
          onNone: () => Effect.succeed(undefined),
          onSome: parseIssueSelector,
        }),
        projectId,
        priority: priorityValue,
      };

      if (dryRun) {
        yield* Console.log(encodeJson({ dryRun: true, operation: "issue.create", input }));
        return;
      }

      // Create the issue
      const created = yield* linear.createIssue(input);

      if (json) {
        yield* Console.log(encodeJson(toCreatedIssue(created)));
        return;
      }

      yield* Console.log(`\nCreated: ${created.identifier} - ${created.title}`);
      yield* Console.log(`URL: ${created.url}`);
      yield* Console.log("");
    }),
).pipe(
  Command.withDescription("Create an issue interactively or from flags"),
  Command.withExamples([
    {
      command: 'linear issue create --team ENG --title "Title" --dry-run',
      description: "Validate and preview a non-interactive creation",
    },
    {
      command: 'linear issue create --team ENG --title "Title" --json',
      description: "Create an issue and return it as JSON",
    },
    { command: "linear issue create --interactive", description: "Create with prompts" },
  ]),
);

export const issueCommentCommand = Command.make(
  "comment",
  {
    id: Argument.string("id").pipe(Argument.withDescription("Issue ID, URL, or identifier")),
    body: bodyOption,
    dryRun: dryRunOption,
    json: jsonFlag,
  },
  ({ id, body, dryRun, json }) =>
    Effect.gen(function* () {
      const issueId = yield* parseIssueSelector(id);
      const commentBody = yield* validateText({
        name: "Comment body",
        value: body,
        maximumLength: 100_000,
      });
      if (dryRun) {
        yield* Console.log(
          encodeJson({
            dryRun: true,
            operation: "issue.comment",
            input: { id: issueId, body: commentBody },
          }),
        );
        return;
      }

      const linear = yield* LinearService;
      const comment = yield* linear.createComment(issueId, commentBody);
      if (json) {
        yield* Console.log(encodeJson(comment));
        return;
      }
      yield* Console.log(`Comment created: ${comment.url}`);
    }),
).pipe(
  Command.withDescription("Add a Markdown comment to an issue"),
  Command.withExamples([
    {
      command: 'linear issue comment ENG-123 --body "Ready" --dry-run',
      description: "Preview a comment without sending it",
    },
    {
      command: 'linear issue comment ENG-123 --body "Ready" --json',
      description: "Create a comment and return its URL",
    },
  ]),
);

// Combined issue command with subcommands
export const issue = Command.make("issue", {}, () =>
  Console.log("Use 'linear issue list' to list issues. See --help for more."),
).pipe(
  Command.withDescription("Read and mutate Linear issues"),
  Command.withSubcommands([
    issueListCommand,
    issueViewCommand,
    issueStartCommand,
    issueCreateCommand,
    issueCommentCommand,
  ]),
);

// Helper functions

const selectIssue = Effect.gen(function* () {
  const linear = yield* LinearService;
  const issues = yield* linear.getMyIssues({ state: "started" });
  const allIssues = issues.length > 0 ? issues : yield* linear.getMyIssues({ state: "unstarted" });

  if (allIssues.length === 0) {
    return yield* NoIssuesError.default;
  }

  // Build choices with state info
  const choices = allIssues.slice(0, 20).map((candidate) => ({
    title: `${candidate.identifier}: ${truncate(candidate.title, 40)}`,
    value: candidate.identifier,
    description: candidate.state?.name ?? "Unknown state",
  }));

  const selected = yield* Prompt.select({
    message: "Select an issue",
    choices,
  });

  return selected;
});

const renderIssueDetails = Effect.fn("IssueCommand.renderDetails")(function* (
  details: IssueDetails,
) {
  yield* Console.log("");
  yield* Console.log(`${details.identifier}: ${details.title}`);
  yield* Console.log(`${"─".repeat(60)}`);
  yield* Console.log(`State:    ${details.state?.name ?? "Unknown"}`);
  yield* Console.log(`Team:     ${details.team?.name ?? "Unknown"}`);
  yield* Console.log(`Priority: ${details.priority.label}`);
  yield* Console.log(`Assignee: ${details.assignee?.name ?? "Unassigned"}`);
  yield* Console.log(`Project:  ${details.project?.name ?? "None"}`);
  yield* Console.log(`Parent:   ${details.parent?.identifier ?? "None"}`);
  yield* Console.log(`Branch:   ${details.branchName}`);
  yield* Console.log(`URL:      ${details.url}`);

  if (details.description !== undefined) {
    yield* Console.log(`\nDescription:\n${details.description}`);
  }
  if (details.children !== undefined) {
    yield* Console.log(`\nSub-issues (${details.children.length}):`);
    for (const child of details.children) {
      yield* Console.log(`  ${child.identifier}  ${child.title}`);
    }
  }
  if (details.comments !== undefined) {
    yield* Console.log(`\nComments (${details.comments.length}):`);
    for (const comment of details.comments) {
      yield* Console.log(
        `  ${comment.author?.name ?? "Unknown"} · ${comment.createdAt}\n  ${comment.body}`,
      );
    }
  }
  if (details.relations !== undefined) {
    yield* Console.log(`\nRelations (${details.relations.length}):`);
    for (const relation of details.relations) {
      yield* Console.log(
        `  ${relation.direction} ${relation.type} ${relation.issue.identifier}  ${relation.issue.title}`,
      );
    }
  }

  yield* Console.log("");
});

function selectTeam(teams: readonly { id: string; key: string; name: string }[]) {
  return Prompt.select({
    message: "Select a team",
    choices: teams.map((team) => ({
      title: `${team.key}: ${team.name}`,
      value: team.id,
    })),
  });
}

const resolveTeamId = Effect.fn("IssueCommand.resolveTeamId")(function* (
  teams: readonly { id: string; key: string; name: string }[],
  selector: string | undefined,
  interactive: boolean,
) {
  if (selector !== undefined) {
    const normalized = selector.toLowerCase();
    const selected = teams.find(
      (team) => team.id === selector || team.key.toLowerCase() === normalized,
    );
    return selected === undefined
      ? yield* InvalidInputError.make({ message: `Unknown team: ${selector}` })
      : selected.id;
  }
  if (teams.length === 1) {
    const [team] = teams;
    return team === undefined
      ? yield* InvalidInputError.make({ message: "No team available" })
      : team.id;
  }
  return interactive
    ? yield* selectTeam(teams)
    : yield* InvalidInputError.make({ message: "--team is required when multiple teams exist" });
});

const resolveProjectId = Effect.fn("IssueCommand.resolveProjectId")(function* (
  projects: readonly { id: string; name: string; slug: string }[],
  selector: string,
) {
  const normalized = selector.toLowerCase();
  const selected = projects.find(
    (project) =>
      project.id === selector ||
      project.name.toLowerCase() === normalized ||
      project.slug.toLowerCase() === normalized,
  );
  return selected === undefined
    ? yield* InvalidInputError.make({ message: `Unknown project: ${selector}` })
    : selected.id;
});

const toCreatedIssue = (created: {
  id: string;
  identifier: string;
  title: string;
  url: string;
}) => ({
  id: created.id,
  identifier: created.identifier,
  title: created.title,
  url: created.url,
});

function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len - 1) + "…" : str;
}

function getPriorityIcon(priority: number): string {
  switch (priority) {
    case 0:
      return "○"; // No priority
    case 1:
      return "⬆"; // Urgent
    case 2:
      return "↑"; // High
    case 3:
      return "─"; // Medium
    case 4:
      return "↓"; // Low
    default:
      return "○";
  }
}
