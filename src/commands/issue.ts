import { Args, Command, Options, Prompt } from "@effect/cli";
import type { Terminal } from "@effect/platform";
import type { Context, Types } from "effect";
import { Console, Effect, Option } from "effect";
import { NoIssuesError, type LinearApiError, type TokenNotFoundError } from "../lib/errors.js";
import { LinearService } from "../services/Linear.js";
import { ConfigService } from "../services/Config.js";

/** Resolve LinearFetch<T> | undefined (LinearFetch is Promise-like lazy loader) */
const resolveFetch = <T>(fetch: PromiseLike<T> | undefined): Effect.Effect<T | null> =>
  fetch !== undefined
    ? Effect.tryPromise(() => Promise.resolve(fetch)).pipe(Effect.orElseSucceed(() => null))
    : Effect.succeed(null);

// Options
const stateOption = Options.text("state").pipe(
  Options.withAlias("s"),
  Options.withDescription("Filter by state type (started, unstarted, backlog, etc.)"),
  Options.optional,
);

const limitOption = Options.integer("limit").pipe(
  Options.withAlias("n"),
  Options.withDefault(20),
  Options.withDescription("Number of issues to show"),
);

// Create options
const titleOption = Options.text("title").pipe(
  Options.withAlias("t"),
  Options.withDescription("Issue title (skips interactive prompt when provided)"),
  Options.optional,
);

const descriptionOption = Options.text("description").pipe(
  Options.withAlias("d"),
  Options.withDescription("Issue description (markdown)"),
  Options.optional,
);

const teamOption = Options.text("team").pipe(
  Options.withDescription("Team key or ID"),
  Options.optional,
);

const parentIdOption = Options.text("parent-id").pipe(
  Options.withDescription("Parent issue identifier (e.g. TEAM-123) to create a sub-issue"),
  Options.optional,
);

const priorityOption = Options.integer("priority").pipe(
  Options.withAlias("p"),
  Options.withDescription("Priority level (0=none, 1=urgent, 2=high, 3=medium, 4=low)"),
  Options.optional,
);

// Args
const issueIdArg = Args.text({ name: "id" }).pipe(
  Args.withDescription("Issue ID or identifier (e.g., ABC-123)"),
  Args.optional,
);

// linear issue list - List issues
export const issueListCommand = Command.make(
  "list",
  { state: stateOption, limit: limitOption },
  ({ state, limit }) =>
    Effect.gen(function* () {
      const linear = yield* LinearService;

      const stateFilter = Option.getOrUndefined(state);
      const issues = yield* linear.getMyIssues({ state: stateFilter });

      if (issues.length === 0) {
        yield* Console.log("No issues found.");
        return;
      }

      yield* Console.log("\nYour Issues:\n");

      const displayed = issues.slice(0, limit);
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
export const issueViewCommand = Command.make("view", { id: issueIdArg }, ({ id }) =>
  Effect.gen(function* () {
    const linear = yield* LinearService;

    // If no ID provided, prompt for selection
    const issueId = yield* Option.match(id, {
      onNone: () => selectIssue(linear),
      onSome: (id) => Effect.succeed(id),
    });

    const issue = yield* linear.getIssue(issueId);
    const issueState = yield* resolveFetch(issue.state);
    const assignee = yield* resolveFetch(issue.assignee);
    const issueTeam = yield* resolveFetch(issue.team);

    yield* Console.log("");
    yield* Console.log(`${issue.identifier}: ${issue.title}`);
    yield* Console.log(`${"─".repeat(60)}`);
    yield* Console.log(`State:    ${issueState?.name ?? "Unknown"}`);
    yield* Console.log(`Team:     ${issueTeam?.name ?? "Unknown"}`);
    yield* Console.log(`Priority: ${getPriorityLabel(issue.priority ?? 0)}`);
    yield* Console.log(`Assignee: ${assignee?.name ?? "Unassigned"}`);
    yield* Console.log(`URL:      ${issue.url}`);

    if (issue.description !== undefined && issue.description !== null) {
      yield* Console.log(`\nDescription:\n${issue.description}`);
    }

    yield* Console.log("");
  }),
);

// linear issue start [id] - Start working on an issue
export const issueStartCommand = Command.make("start", { id: issueIdArg }, ({ id }) =>
  Effect.gen(function* () {
    const linear = yield* LinearService;

    // If no ID provided, prompt for selection
    const issueId = yield* Option.match(id, {
      onNone: () => selectIssue(linear),
      onSome: (id) => Effect.succeed(id),
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
    parentId: parentIdOption,
    priority: priorityOption,
  },
  ({
    title: titleOpt,
    description: descOpt,
    team: teamOpt,
    parentId: parentIdOpt,
    priority: priorityOpt,
  }) =>
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

      // Resolve team ID
      let teamId: string;
      const teamValue = Option.getOrUndefined(teamOpt);

      if (teamValue !== undefined) {
        const team = teams.find((t) => t.id === teamValue || t.key === teamValue);
        if (team !== undefined) {
          teamId = team.id;
        } else {
          yield* Console.error(`Team "${teamValue}" not found.`);
          return;
        }
      } else if (linearConfig.teamId !== undefined) {
        const team = teams.find(
          (t) => t.id === linearConfig.teamId || t.key === linearConfig.teamId,
        );
        if (team !== undefined) {
          teamId = team.id;
          yield* Console.log(`Using team from config: ${team.name}`);
        } else {
          teamId = yield* selectTeam(teams);
        }
      } else if (teams.length === 1) {
        teamId = teams[0].id;
        yield* Console.log(`Using team: ${teams[0].name}`);
      } else {
        teamId = yield* selectTeam(teams);
      }

      // Resolve title
      const title = yield* Option.match(titleOpt, {
        onNone: () => Prompt.text({ message: "Issue title" }),
        onSome: (t) => Effect.succeed(t),
      });

      // Resolve description
      const description = yield* Option.match(descOpt, {
        onNone: () =>
          Option.isSome(titleOpt)
            ? Effect.succeed("")
            : Prompt.text({ message: "Description (optional, press Enter to skip)", default: "" }),
        onSome: (d) => Effect.succeed(d),
      });

      // Resolve parent issue ID (convert identifier like TEAM-123 to internal ID)
      let parentId: string | undefined;
      const parentIdValue = Option.getOrUndefined(parentIdOpt);
      if (parentIdValue !== undefined) {
        const parentIssue = yield* linear.getIssue(parentIdValue);
        parentId = parentIssue.id;
      }

      // Create the issue
      const issue = yield* linear.createIssue({
        title,
        teamId,
        description: description || undefined,
        parentId,
        priority: Option.getOrUndefined(priorityOpt),
      });

      yield* Console.log(`\nCreated: ${issue.identifier} - ${issue.title}`);
      yield* Console.log(`URL: ${issue.url}`);
      yield* Console.log("");
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
  ]),
);

// Helper functions

function selectIssue(
  linear: Context.Tag.Service<typeof LinearService>,
): Effect.Effect<
  string,
  LinearApiError | TokenNotFoundError | NoIssuesError | Types.NoInfer<Terminal.QuitException>,
  Terminal.Terminal
> {
  return Effect.gen(function* () {
    const issues = yield* linear.getMyIssues({ state: "started" });
    const allIssues =
      issues.length > 0 ? issues : yield* linear.getMyIssues({ state: "unstarted" });

    if (allIssues.length === 0) {
      return yield* NoIssuesError.default;
    }

    // Build choices with state info
    const choices = yield* Effect.all(
      allIssues.slice(0, 20).map((issue) =>
        Effect.gen(function* () {
          const issueState = yield* resolveFetch(issue.state);
          return {
            title: `${issue.identifier}: ${truncate(issue.title, 40)}`,
            value: issue.identifier,
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
}

function selectTeam(teams: readonly { id: string; key: string; name: string }[]) {
  return Prompt.select({
    message: "Select a team",
    choices: teams.map((team) => ({
      title: `${team.key}: ${team.name}`,
      value: team.id,
    })),
  });
}

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
