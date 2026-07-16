import { Argument, Command, Flag, Prompt } from "effect/unstable/cli";
import { Console, Effect, Option } from "effect";
import { InvalidInputError, NoIssuesError } from "../lib/errors.js";
import { encodeJson } from "../lib/json.js";
import { LinearService, type IssueDetails } from "../services/Linear.js";
import { ConfigService } from "../services/Config.js";

/** Resolve LinearFetch<T> | undefined (LinearFetch is Promise-like lazy loader) */
const resolveFetch = <T>(fetch: PromiseLike<T> | undefined): Effect.Effect<T | null> =>
  fetch !== undefined
    ? Effect.tryPromise(() => Promise.resolve(fetch)).pipe(Effect.orElseSucceed(() => null))
    : Effect.succeed(null);

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

const jsonOption = Flag.boolean("json").pipe(
  Flag.withDescription("Emit stable JSON for scripts and agents"),
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

const bodyOption = Flag.string("body").pipe(Flag.withDescription("Comment body in Markdown"));

// Args
const issueIdsArg = Argument.string("id").pipe(
  Argument.withDescription("Issue ID, URL, or identifier (repeat for bulk reads)"),
  Argument.variadic(),
);

// linear issue list - List issues
export const issueListCommand = Command.make(
  "list",
  { state: stateOption, limit: limitOption, json: jsonOption },
  ({ state, limit, json }) =>
    Effect.gen(function* () {
      const linear = yield* LinearService;

      const stateFilter = Option.getOrUndefined(state);
      const issues = yield* linear.getMyIssues({ state: stateFilter });

      if (issues.length === 0) {
        yield* Console.log(json ? "[]" : "No issues found.");
        return;
      }

      yield* Console.log("\nYour Issues:\n");

      const displayed = issues.slice(0, limit);

      if (json) {
        const values = yield* Effect.forEach(
          displayed,
          (issue) =>
            resolveFetch(issue.state).pipe(
              Effect.map((issueState) => ({
                id: issue.id,
                identifier: issue.identifier,
                title: issue.title,
                url: issue.url,
                branchName: issue.branchName,
                priority: { value: issue.priority, label: getPriorityLabel(issue.priority) },
                state:
                  issueState === null
                    ? undefined
                    : { id: issueState.id, name: issueState.name, type: issueState.type },
              })),
            ),
          { concurrency: 4 },
        );
        yield* Console.log(encodeJson(values));
        return;
      }

      for (const issue of displayed) {
        const issueState = yield* resolveFetch(issue.state);
        const stateName = issueState?.name ?? "Unknown";
        const priority = issue.priority ?? 0;
        const priorityIcon = getPriorityIcon(priority);

        yield* Console.log(
          `  ${priorityIcon} ${issue.identifier.padEnd(10)} ${stateName.padEnd(12)} ${truncate(issue.title, 50)}`,
        );
      }

      if (issues.length > limit) {
        yield* Console.log(`\n  ... and ${issues.length - limit} more`);
      }

      yield* Console.log("");
    }),
);

// linear issue view [id] - View issue details
export const issueViewCommand = Command.make(
  "view",
  {
    ids: issueIdsArg,
    json: jsonOption,
    comments: commentsOption,
    children: childrenOption,
    relations: relationsOption,
  },
  ({ ids, json, comments, children, relations }) =>
    Effect.gen(function* () {
      const linear = yield* LinearService;
      const selectedIds = ids.length === 0 ? [yield* selectIssue] : ids;
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
);

// linear issue start [id] - Start working on an issue
const optionalIssueIdArg = Argument.string("id").pipe(
  Argument.withDescription("Issue ID, URL, or identifier"),
  Argument.optional,
);

export const issueStartCommand = Command.make("start", { id: optionalIssueIdArg }, ({ id }) =>
  Effect.gen(function* () {
    const linear = yield* LinearService;

    // If no ID provided, prompt for selection
    const issueId = yield* Option.match(id, {
      onNone: () => selectIssue,
      onSome: (selectedId) => Effect.succeed(selectedId),
    });

    const issue = yield* linear.getIssue(issueId);
    const issueTeam = yield* resolveFetch(issue.team);

    // Get the "Started" state for this team
    const states = yield* Effect.tryPromise({
      try: async () => {
        if (issueTeam === null) return [];
        const connection = await issueTeam.states();
        return connection.nodes;
      },
      catch: () => [],
    });

    const startedState = states.find(
      (s) => s.type === "started" || s.name.toLowerCase() === "in progress",
    );

    if (startedState !== undefined) {
      yield* linear.updateIssueState(issue.id, startedState.id);
      yield* Console.log(`\nStarted: ${issue.identifier} - ${issue.title}`);
      yield* Console.log(`State changed to: ${startedState.name}`);
    } else {
      yield* Console.log(`\nCould not find a "started" state for this issue's team.`);
    }

    // Show branch name for git
    if (issue.branchName !== undefined && issue.branchName !== null) {
      yield* Console.log(`\nBranch name: ${issue.branchName}`);
    }

    yield* Console.log("");
  }),
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
    json: jsonOption,
  },
  ({ title, description, team, parent, project, priority, dryRun, json }) =>
    Effect.gen(function* () {
      const linear = yield* LinearService;
      const config = yield* ConfigService;
      const linearConfig = yield* config.getConfig;

      // Get teams for selection
      const teams = yield* linear.getTeams;

      if (teams.length === 0) {
        yield* Console.error("No teams found. Cannot create issue.");
        return;
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
        title: issueTitle,
        teamId,
        description: issueDescription.length === 0 ? undefined : issueDescription,
        parentId: Option.getOrUndefined(parent),
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
);

export const issueCommentCommand = Command.make(
  "comment",
  {
    id: Argument.string("id").pipe(Argument.withDescription("Issue ID, URL, or identifier")),
    body: bodyOption,
    dryRun: dryRunOption,
    json: jsonOption,
  },
  ({ id, body, dryRun, json }) =>
    Effect.gen(function* () {
      if (dryRun) {
        yield* Console.log(
          encodeJson({ dryRun: true, operation: "issue.comment", input: { id, body } }),
        );
        return;
      }

      const linear = yield* LinearService;
      const comment = yield* linear.createComment(id, body);
      if (json) {
        yield* Console.log(encodeJson(comment));
        return;
      }
      yield* Console.log(`Comment created: ${comment.url}`);
    }),
);

// Combined issue command with subcommands
export const issue = Command.make("issue", {}, () =>
  Console.log("Use 'linear issue list' to list issues. See --help for more."),
).pipe(
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
  const choices = yield* Effect.all(
    allIssues.slice(0, 20).map((candidate) =>
      Effect.gen(function* () {
        const issueState = yield* resolveFetch(candidate.state);
        return {
          title: `${candidate.identifier}: ${truncate(candidate.title, 40)}`,
          value: candidate.identifier,
          description: issueState?.name ?? "Unknown state",
        };
      }),
    ),
  );

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
  projects: readonly { id: string; name: string; slugId: string }[],
  selector: string,
) {
  const normalized = selector.toLowerCase();
  const selected = projects.find(
    (project) =>
      project.id === selector ||
      project.name.toLowerCase() === normalized ||
      project.slugId.toLowerCase() === normalized,
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

function getPriorityLabel(priority: number): string {
  switch (priority) {
    case 0:
      return "No priority";
    case 1:
      return "Urgent";
    case 2:
      return "High";
    case 3:
      return "Medium";
    case 4:
      return "Low";
    default:
      return "Unknown";
  }
}
