import { Context, Effect, Layer, Option, Ref } from "effect"
import { LinearClient, Issue, User, Team } from "@linear/sdk"
import { LinearApiError, InvalidTokenError, TokenNotFoundError } from "../lib/errors.js"
import { ConfigService } from "./Config.js"

export interface IssueFilter {
  readonly teamId?: string
  readonly state?: "triage" | "backlog" | "unstarted" | "started" | "completed" | "canceled"
  readonly assigneeId?: string
  readonly limit?: number
}

export class LinearService extends Context.Tag("@linear/LinearService")<
  LinearService,
  {
    readonly getViewer: Effect.Effect<User, LinearApiError | InvalidTokenError | TokenNotFoundError>
    readonly getTeams: Effect.Effect<readonly Team[], LinearApiError | TokenNotFoundError>
    readonly getIssues: (filter: IssueFilter) => Effect.Effect<readonly Issue[], LinearApiError | TokenNotFoundError>
    readonly getIssue: (id: string) => Effect.Effect<Issue, LinearApiError | TokenNotFoundError>
    readonly getMyIssues: (filter?: { state?: string }) => Effect.Effect<readonly Issue[], LinearApiError | TokenNotFoundError>
    readonly updateIssueState: (issueId: string, stateId: string) => Effect.Effect<void, LinearApiError | TokenNotFoundError>
    readonly createIssue: (input: {
      title: string
      teamId: string
      description?: string
    }) => Effect.Effect<Issue, LinearApiError | TokenNotFoundError>
  }
>() {
  static readonly layer = Layer.effect(
    LinearService,
    Effect.gen(function* () {
      const configService = yield* ConfigService

      // Cache the client once token is loaded
      const clientRef = yield* Ref.make<LinearClient | null>(null)

      // Get or create client lazily
      const getClient = Effect.gen(function* () {
        const cached = yield* Ref.get(clientRef)
        if (cached) return cached

        const token = yield* configService.getToken
        const client = new LinearClient({ apiKey: token })
        yield* Ref.set(clientRef, client)
        return client
      })

      const getViewer = Effect.gen(function* () {
        const client = yield* getClient
        const viewer = yield* Effect.tryPromise({
          try: () => client.viewer,
          catch: (e) => {
            const msg = String(e)
            if (msg.includes("Authentication") || msg.includes("401")) {
              return InvalidTokenError.make({ message: "Invalid API token" })
            }
            return LinearApiError.make({ message: msg })
          },
        })
        return viewer
      })

      const getTeams = Effect.gen(function* () {
        const client = yield* getClient
        const teams = yield* Effect.tryPromise({
          try: async () => {
            const connection = await client.teams()
            return connection.nodes
          },
          catch: (e) => LinearApiError.make({ message: String(e) }),
        })
        return teams
      })

      const getIssues = (filter: IssueFilter) =>
        Effect.gen(function* () {
          const client = yield* getClient
          const issues = yield* Effect.tryPromise({
            try: async () => {
              const connection = await client.issues({
                first: filter.limit ?? 50,
                filter: {
                  team: filter.teamId ? { id: { eq: filter.teamId } } : undefined,
                  state: filter.state ? { type: { eq: filter.state } } : undefined,
                  assignee: filter.assigneeId
                    ? { id: { eq: filter.assigneeId } }
                    : undefined,
                },
              })
              return connection.nodes
            },
            catch: (e) => LinearApiError.make({ message: String(e) }),
          })
          return issues
        })

      const getMyIssues = (filter?: { state?: string }) =>
        Effect.gen(function* () {
          const client = yield* getClient
          const issues = yield* Effect.tryPromise({
            try: async () => {
              const viewer = await client.viewer
              const connection = await viewer.assignedIssues({
                first: 50,
                filter: filter?.state
                  ? { state: { type: { eq: filter.state } } }
                  : undefined,
              })
              return connection.nodes
            },
            catch: (e) => LinearApiError.make({ message: String(e) }),
          })
          return issues
        })

      const getIssue = (id: string) =>
        Effect.gen(function* () {
          const client = yield* getClient
          const issue = yield* Effect.tryPromise({
            try: () => client.issue(id),
            catch: (e) => LinearApiError.make({ message: String(e) }),
          })
          return issue
        })

      const updateIssueState = (issueId: string, stateId: string) =>
        Effect.gen(function* () {
          const client = yield* getClient
          yield* Effect.tryPromise({
            try: () => client.updateIssue(issueId, { stateId }),
            catch: (e) => LinearApiError.make({ message: String(e) }),
          })
        })

      const createIssue = (input: {
        title: string
        teamId: string
        description?: string
      }) =>
        Effect.gen(function* () {
          const client = yield* getClient
          const result = yield* Effect.tryPromise({
            try: async () => {
              const payload = await client.createIssue({
                title: input.title,
                teamId: input.teamId,
                description: input.description,
              })
              const issue = await payload.issue
              if (!issue) throw new Error("Failed to create issue")
              return issue
            },
            catch: (e) => LinearApiError.make({ message: String(e) }),
          })
          return result
        })

      return LinearService.of({
        getViewer,
        getTeams,
        getIssues,
        getMyIssues,
        getIssue,
        updateIssueState,
        createIssue,
      })
    })
  )

  static readonly testLayer = (options?: {
    viewer?: User
    teams?: readonly Team[]
    issues?: readonly Issue[]
  }) =>
    Layer.succeed(LinearService, {
      getViewer: options?.viewer
        ? Effect.succeed(options.viewer)
        : Effect.fail(LinearApiError.make({ message: "No viewer in test" })),
      getTeams: Effect.succeed(options?.teams ?? []),
      getIssues: (_filter) => Effect.succeed(options?.issues ?? []),
      getMyIssues: (_filter) => Effect.succeed(options?.issues ?? []),
      getIssue: (id) => {
        const issue = options?.issues?.find((i) => i.id === id || (i as any).identifier === id)
        return issue
          ? Effect.succeed(issue)
          : Effect.fail(LinearApiError.make({ message: `Issue ${id} not found` }))
      },
      updateIssueState: (_issueId, _stateId) => Effect.void,
      createIssue: (_input) =>
        Effect.fail(LinearApiError.make({ message: "Not implemented in test" })),
    })
}
