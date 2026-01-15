import { Args, Command, Options, Prompt } from "@effect/cli"
import { Console, Effect, Option } from "effect"
import { LinearService } from "../services/Linear.js"
import { ConfigService } from "../services/Config.js"

// Options
const stateOption = Options.text("state").pipe(
  Options.withAlias("s"),
  Options.withDescription("Filter by state type (started, unstarted, backlog, etc.)"),
  Options.optional
)

const teamOption = Options.text("team").pipe(
  Options.withAlias("t"),
  Options.withDescription("Filter by team key or ID"),
  Options.optional
)

const limitOption = Options.integer("limit").pipe(
  Options.withAlias("n"),
  Options.withDefault(20),
  Options.withDescription("Number of issues to show")
)

// Args
const issueIdArg = Args.text({ name: "id" }).pipe(
  Args.withDescription("Issue ID or identifier (e.g., ABC-123)"),
  Args.optional
)

// linear issue list - List issues
export const issueListCommand = Command.make(
  "list",
  { state: stateOption, team: teamOption, limit: limitOption },
  ({ state, team, limit }) =>
    Effect.gen(function* () {
      const linear = yield* LinearService

      const stateFilter = Option.getOrUndefined(state) as any
      const issues = yield* linear.getMyIssues({ state: stateFilter })

      if (issues.length === 0) {
        yield* Console.log("No issues found.")
        return
      }

      yield* Console.log("\nYour Issues:\n")

      const displayed = issues.slice(0, limit)
      for (const issue of displayed) {
        const state = yield* Effect.tryPromise({
          try: () => issue.state,
          catch: () => null,
        })
        const stateName = state?.name ?? "Unknown"
        const priority = issue.priority ?? 0
        const priorityIcon = getPriorityIcon(priority)

        yield* Console.log(
          `  ${priorityIcon} ${issue.identifier.padEnd(10)} ${stateName.padEnd(12)} ${truncate(issue.title, 50)}`
        )
      }

      if (issues.length > limit) {
        yield* Console.log(`\n  ... and ${issues.length - limit} more`)
      }

      yield* Console.log("")
    })
)

// linear issue view [id] - View issue details
export const issueViewCommand = Command.make(
  "view",
  { id: issueIdArg },
  ({ id }) =>
    Effect.gen(function* () {
      const linear = yield* LinearService

      // If no ID provided, prompt for selection
      const issueId = yield* Option.match(id, {
        onNone: () => selectIssue(linear),
        onSome: (id) => Effect.succeed(id),
      })

      const issue = yield* linear.getIssue(issueId)
      const state = yield* Effect.tryPromise({
        try: () => issue.state,
        catch: () => null,
      })
      const assignee = yield* Effect.tryPromise({
        try: () => issue.assignee,
        catch: () => null,
      })
      const team = yield* Effect.tryPromise({
        try: () => issue.team,
        catch: () => null,
      })

      yield* Console.log("")
      yield* Console.log(`${issue.identifier}: ${issue.title}`)
      yield* Console.log(`${"─".repeat(60)}`)
      yield* Console.log(`State:    ${state?.name ?? "Unknown"}`)
      yield* Console.log(`Team:     ${team?.name ?? "Unknown"}`)
      yield* Console.log(`Priority: ${getPriorityLabel(issue.priority ?? 0)}`)
      yield* Console.log(`Assignee: ${assignee?.name ?? "Unassigned"}`)
      yield* Console.log(`URL:      ${issue.url}`)

      if (issue.description) {
        yield* Console.log(`\nDescription:\n${issue.description}`)
      }

      yield* Console.log("")
    })
)

// linear issue start [id] - Start working on an issue
export const issueStartCommand = Command.make(
  "start",
  { id: issueIdArg },
  ({ id }) =>
    Effect.gen(function* () {
      const linear = yield* LinearService

      // If no ID provided, prompt for selection
      const issueId = yield* Option.match(id, {
        onNone: () => selectIssue(linear),
        onSome: (id) => Effect.succeed(id),
      })

      const issue = yield* linear.getIssue(issueId)
      const team = yield* Effect.tryPromise({
        try: () => issue.team,
        catch: () => null,
      })

      // Get the "Started" state for this team
      const states = yield* Effect.tryPromise({
        try: async () => {
          if (!team) return []
          const connection = await team.states()
          return connection.nodes
        },
        catch: () => [],
      })

      const startedState = states.find(
        (s) => s.type === "started" || s.name.toLowerCase() === "in progress"
      )

      if (startedState) {
        yield* linear.updateIssueState(issue.id, startedState.id)
        yield* Console.log(`\nStarted: ${issue.identifier} - ${issue.title}`)
        yield* Console.log(`State changed to: ${startedState.name}`)
      } else {
        yield* Console.log(`\nCould not find a "started" state for this issue's team.`)
      }

      // Show branch name for git
      if (issue.branchName) {
        yield* Console.log(`\nBranch name: ${issue.branchName}`)
      }

      yield* Console.log("")
    })
)

// linear issue create - Create a new issue
export const issueCreateCommand = Command.make("create", {}, () =>
  Effect.gen(function* () {
    const linear = yield* LinearService
    const config = yield* ConfigService
    const linearConfig = yield* config.getConfig

    // Get teams for selection
    const teams = yield* linear.getTeams

    if (teams.length === 0) {
      yield* Console.error("No teams found. Cannot create issue.")
      return
    }

    // Select team (or use default from config)
    let teamId: string

    if (linearConfig.teamId) {
      const team = teams.find(
        (t) => t.id === linearConfig.teamId || t.key === linearConfig.teamId
      )
      if (team) {
        teamId = team.id
        yield* Console.log(`Using team from config: ${team.name}`)
      } else {
        teamId = yield* selectTeam(teams)
      }
    } else if (teams.length === 1) {
      teamId = teams[0].id
      yield* Console.log(`Using team: ${teams[0].name}`)
    } else {
      teamId = yield* selectTeam(teams)
    }

    // Prompt for title
    const title = yield* Prompt.text({
      message: "Issue title",
    })

    // Prompt for description (optional)
    const description = yield* Prompt.text({
      message: "Description (optional, press Enter to skip)",
      default: "",
    })

    // Create the issue
    const issue = yield* linear.createIssue({
      title,
      teamId,
      description: description || undefined,
    })

    yield* Console.log(`\nCreated: ${issue.identifier} - ${issue.title}`)
    yield* Console.log(`URL: ${issue.url}`)
    yield* Console.log("")
  })
)

// Combined issue command with subcommands
export const issue = Command.make("issue", {}, () =>
  Console.log("Use 'linear issue list' to list issues. See --help for more.")
).pipe(
  Command.withSubcommands([
    issueListCommand,
    issueViewCommand,
    issueStartCommand,
    issueCreateCommand,
  ])
)

// Helper functions

function selectIssue(
  linear: Context.Tag.Service<typeof LinearService>
): Effect.Effect<string, any, any> {
  return Effect.gen(function* () {
    const issues = yield* linear.getMyIssues({ state: "started" })
    const allIssues =
      issues.length > 0
        ? issues
        : yield* linear.getMyIssues({ state: "unstarted" })

    if (allIssues.length === 0) {
      yield* Console.error("No issues found to select from.")
      return yield* Effect.die("No issues")
    }

    // Build choices with state info
    const choices = yield* Effect.all(
      allIssues.slice(0, 20).map((issue) =>
        Effect.gen(function* () {
          const state = yield* Effect.tryPromise({
            try: () => issue.state,
            catch: () => null,
          })
          return {
            title: `${issue.identifier}: ${truncate(issue.title, 40)}`,
            value: issue.identifier,
            description: state?.name ?? "Unknown state",
          }
        })
      )
    )

    const selected = yield* Prompt.select({
      message: "Select an issue",
      choices,
    })

    return selected
  })
}

function selectTeam(
  teams: readonly { id: string; key: string; name: string }[]
): Effect.Effect<string, any, any> {
  return Prompt.select({
    message: "Select a team",
    choices: teams.map((team) => ({
      title: `${team.key}: ${team.name}`,
      value: team.id,
    })),
  })
}

function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len - 1) + "…" : str
}

function getPriorityIcon(priority: number): string {
  switch (priority) {
    case 0:
      return "○" // No priority
    case 1:
      return "⬆" // Urgent
    case 2:
      return "↑" // High
    case 3:
      return "─" // Medium
    case 4:
      return "↓" // Low
    default:
      return "○"
  }
}

function getPriorityLabel(priority: number): string {
  switch (priority) {
    case 0:
      return "No priority"
    case 1:
      return "Urgent"
    case 2:
      return "High"
    case 3:
      return "Medium"
    case 4:
      return "Low"
    default:
      return "Unknown"
  }
}
