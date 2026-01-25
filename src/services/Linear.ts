import { Context, Effect, Layer } from "effect";
import { LinearClient } from "@linear/sdk";
import type { Issue, User, Team } from "@linear/sdk";
import { LinearApiError, InvalidTokenError, TokenNotFoundError } from "../lib/errors.js";
import { ConfigService } from "./Config.js";

export interface IssueFilter {
  readonly teamId?: string;
  readonly state?: "triage" | "backlog" | "unstarted" | "started" | "completed" | "canceled";
  readonly assigneeId?: string;
  readonly limit?: number;
}

export class LinearService extends Context.Tag("@linear/LinearService")<
  LinearService,
  {
    readonly getViewer: Effect.Effect<
      User,
      LinearApiError | InvalidTokenError | TokenNotFoundError
    >;
    readonly getTeams: Effect.Effect<readonly Team[], LinearApiError | TokenNotFoundError>;
    readonly getIssues: (
      filter: IssueFilter,
    ) => Effect.Effect<readonly Issue[], LinearApiError | TokenNotFoundError>;
    readonly getIssue: (id: string) => Effect.Effect<Issue, LinearApiError | TokenNotFoundError>;
    readonly getMyIssues: (filter?: {
      state?: string;
    }) => Effect.Effect<readonly Issue[], LinearApiError | TokenNotFoundError>;
    readonly updateIssueState: (
      issueId: string,
      stateId: string,
    ) => Effect.Effect<void, LinearApiError | TokenNotFoundError>;
    readonly createIssue: (input: {
      title: string;
      teamId: string;
      description?: string;
    }) => Effect.Effect<Issue, LinearApiError | TokenNotFoundError>;
  }
>() {
  static readonly layer = Layer.effect(
    LinearService,
    Effect.gen(function* () {
      const configService = yield* ConfigService;

      // Lazy client creation - token is loaded when first API call is made
      const getClient = configService.getToken.pipe(
        Effect.catchTag("ConfigError", (e) => TokenNotFoundError.make({ message: e.message })),
        Effect.map((token) => new LinearClient({ apiKey: token })),
        Effect.cached,
        Effect.runSync,
      );

      const getViewer = Effect.gen(function* () {
        const client = yield* getClient;
        return yield* Effect.tryPromise({
          try: () => client.viewer,
          catch: (e) => {
            const msg = String(e);
            if (msg.includes("Authentication") || msg.includes("401")) {
              return InvalidTokenError.make({ message: "Invalid API token" });
            }
            return LinearApiError.make({ message: msg });
          },
        });
      }).pipe(Effect.withSpan("LinearService.getViewer"));

      const getTeams = Effect.gen(function* () {
        const client = yield* getClient;
        const connection = yield* Effect.tryPromise({
          try: () => client.teams(),
          catch: (e) => LinearApiError.make({ message: String(e) }),
        });
        return connection.nodes;
      }).pipe(Effect.withSpan("LinearService.getTeams"));

      const getIssues = Effect.fn("LinearService.getIssues")((filter: IssueFilter) =>
        Effect.gen(function* () {
          const client = yield* getClient;
          const connection = yield* Effect.tryPromise({
            try: () =>
              client.issues({
                first: filter.limit ?? 50,
                filter: {
                  team: filter.teamId ? { id: { eq: filter.teamId } } : undefined,
                  state: filter.state ? { type: { eq: filter.state } } : undefined,
                  assignee: filter.assigneeId ? { id: { eq: filter.assigneeId } } : undefined,
                },
              }),
            catch: (e) => LinearApiError.make({ message: String(e) }),
          });
          return connection.nodes;
        }),
      );

      const getMyIssues = Effect.fn("LinearService.getMyIssues")((filter?: { state?: string }) =>
        Effect.gen(function* () {
          const client = yield* getClient;
          const viewer = yield* Effect.tryPromise({
            try: () => client.viewer,
            catch: (e) => LinearApiError.make({ message: String(e) }),
          });
          const connection = yield* Effect.tryPromise({
            try: () =>
              viewer.assignedIssues({
                first: 50,
                filter: filter?.state ? { state: { type: { eq: filter.state } } } : undefined,
              }),
            catch: (e) => LinearApiError.make({ message: String(e) }),
          });
          return connection.nodes;
        }),
      );

      const getIssue = Effect.fn("LinearService.getIssue")((id: string) =>
        Effect.gen(function* () {
          const client = yield* getClient;
          return yield* Effect.tryPromise({
            try: () => client.issue(id),
            catch: (e) => LinearApiError.make({ message: String(e) }),
          });
        }),
      );

      const updateIssueState = Effect.fn("LinearService.updateIssueState")(
        (issueId: string, stateId: string) =>
          Effect.gen(function* () {
            const client = yield* getClient;
            yield* Effect.tryPromise({
              try: () => client.updateIssue(issueId, { stateId }),
              catch: (e) => LinearApiError.make({ message: String(e) }),
            });
          }),
      );

      const createIssue = Effect.fn("LinearService.createIssue")(
        (input: { title: string; teamId: string; description?: string }) =>
          Effect.gen(function* () {
            const client = yield* getClient;
            const payload = yield* Effect.tryPromise({
              try: () =>
                client.createIssue({
                  title: input.title,
                  teamId: input.teamId,
                  description: input.description,
                }),
              catch: (e) => LinearApiError.make({ message: String(e) }),
            });
            const issueFetch = payload.issue;
            if (!issueFetch) {
              return yield* LinearApiError.make({ message: "Failed to create issue" });
            }
            return yield* Effect.tryPromise({
              try: () => issueFetch,
              catch: (e) => LinearApiError.make({ message: String(e) }),
            });
          }),
      );

      return LinearService.of({
        getViewer,
        getTeams,
        getIssues,
        getMyIssues,
        getIssue,
        updateIssueState,
        createIssue,
      });
    }),
  );

  static readonly testLayer = (options?: {
    viewer?: User;
    teams?: readonly Team[];
    issues?: readonly Issue[];
  }) =>
    Layer.succeed(LinearService, {
      getViewer: options?.viewer
        ? Effect.succeed(options.viewer)
        : Effect.fail(LinearApiError.make({ message: "No viewer in test" })),
      getTeams: Effect.succeed(options?.teams ?? []),
      getIssues: (_filter) => Effect.succeed(options?.issues ?? []),
      getMyIssues: (_filter) => Effect.succeed(options?.issues ?? []),
      getIssue: (id) => {
        const issue = options?.issues?.find((i) => i.id === id || i.identifier === id);
        return issue
          ? Effect.succeed(issue)
          : Effect.fail(LinearApiError.make({ message: `Issue ${id} not found` }));
      },
      updateIssueState: (_issueId, _stateId) => Effect.void,
      createIssue: (_input) =>
        Effect.fail(LinearApiError.make({ message: "Not implemented in test" })),
    });
}
