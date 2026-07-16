import { Context, Effect, Layer } from "effect";
import { LinearClient } from "@linear/sdk";
import type { Issue, Project, Team, User } from "@linear/sdk";
import { LinearApiError, InvalidTokenError, TokenNotFoundError } from "../lib/errors.js";
import { ConfigService } from "./Config.js";

export interface IssueFilter {
  readonly teamId?: string;
  readonly state?: "triage" | "backlog" | "unstarted" | "started" | "completed" | "canceled";
  readonly assigneeId?: string;
  readonly limit?: number;
}

export interface IssueDetailsOptions {
  readonly comments: boolean;
  readonly children: boolean;
  readonly relations: boolean;
}

export interface IssueReference {
  readonly id: string;
  readonly identifier: string;
  readonly title: string;
  readonly url: string;
}

export interface IssueDetails extends IssueReference {
  readonly description?: string;
  readonly branchName: string;
  readonly priority: {
    readonly value: number;
    readonly label: string;
  };
  readonly state?: {
    readonly id: string;
    readonly name: string;
    readonly type: string;
  };
  readonly team?: {
    readonly id: string;
    readonly key: string;
    readonly name: string;
  };
  readonly assignee?: {
    readonly id: string;
    readonly name: string;
    readonly email: string;
  };
  readonly project?: {
    readonly id: string;
    readonly name: string;
    readonly url: string;
  };
  readonly parent?: IssueReference;
  readonly labels: ReadonlyArray<{ readonly id: string; readonly name: string }>;
  readonly children?: ReadonlyArray<IssueReference>;
  readonly comments?: ReadonlyArray<{
    readonly id: string;
    readonly body: string;
    readonly createdAt: string;
    readonly url: string;
    readonly author?: { readonly id: string; readonly name: string };
  }>;
  readonly relations?: ReadonlyArray<{
    readonly id: string;
    readonly type: string;
    readonly direction: "outbound" | "inbound";
    readonly issue: IssueReference;
  }>;
}

export class LinearService extends Context.Service<
  LinearService,
  {
    readonly getViewer: Effect.Effect<
      User,
      LinearApiError | InvalidTokenError | TokenNotFoundError
    >;
    readonly getTeams: Effect.Effect<readonly Team[], LinearApiError | TokenNotFoundError>;
    readonly getProjects: Effect.Effect<readonly Project[], LinearApiError | TokenNotFoundError>;
    readonly getIssues: (
      filter: IssueFilter,
    ) => Effect.Effect<readonly Issue[], LinearApiError | TokenNotFoundError>;
    readonly getIssue: (id: string) => Effect.Effect<Issue, LinearApiError | TokenNotFoundError>;
    readonly getIssueDetails: (
      id: string,
      options: IssueDetailsOptions,
    ) => Effect.Effect<IssueDetails, LinearApiError | TokenNotFoundError>;
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
      parentId?: string;
      projectId?: string;
      priority?: number;
    }) => Effect.Effect<Issue, LinearApiError | TokenNotFoundError>;
    readonly createComment: (
      issueId: string,
      body: string,
    ) => Effect.Effect<
      { readonly id: string; readonly url: string },
      LinearApiError | TokenNotFoundError
    >;
    readonly rawQuery: (
      query: string,
      variables: Readonly<Record<string, unknown>>,
    ) => Effect.Effect<unknown, LinearApiError | TokenNotFoundError>;
  }
>()("@cvr/linear/services/Linear/LinearService") {
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

      const getProjects = Effect.gen(function* () {
        const client = yield* getClient;
        const connection = yield* Effect.tryPromise({
          try: () => client.projects(),
          catch: (error) => LinearApiError.make({ message: String(error) }),
        });
        return connection.nodes;
      }).pipe(Effect.withSpan("LinearService.getProjects"));

      const getIssues = Effect.fn("LinearService.getIssues")((filter: IssueFilter) =>
        Effect.gen(function* () {
          const client = yield* getClient;
          const connection = yield* Effect.tryPromise({
            try: () =>
              client.issues({
                first: filter.limit ?? 50,
                filter: {
                  team: filter.teamId !== undefined ? { id: { eq: filter.teamId } } : undefined,
                  state: filter.state !== undefined ? { type: { eq: filter.state } } : undefined,
                  assignee:
                    filter.assigneeId !== undefined ? { id: { eq: filter.assigneeId } } : undefined,
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
                filter:
                  filter?.state !== undefined
                    ? { state: { type: { eq: filter.state } } }
                    : undefined,
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

      const getIssueDetails = Effect.fn("LinearService.getIssueDetails")(
        (id: string, options: IssueDetailsOptions) =>
          Effect.gen(function* () {
            const issue = yield* getIssue(normalizeIssueId(id));
            const [state, team, assignee, project, parent, labels] = yield* Effect.all([
              resolveLinearFetch(issue.state),
              resolveLinearFetch(issue.team),
              resolveLinearFetch(issue.assignee),
              resolveLinearFetch(issue.project),
              resolveLinearFetch(issue.parent),
              loadConnection(() => issue.labels()),
            ]);

            const children = options.children
              ? yield* loadConnection(() => issue.children())
              : undefined;
            const comments = options.comments
              ? yield* loadConnection(() => issue.comments())
              : undefined;
            const outboundRelations = options.relations
              ? yield* loadConnection(() => issue.relations())
              : undefined;
            const inboundRelations = options.relations
              ? yield* loadConnection(() => issue.inverseRelations())
              : undefined;

            const detailedComments =
              comments === undefined
                ? undefined
                : yield* Effect.forEach(
                    comments,
                    (comment) =>
                      resolveLinearFetch(comment.user).pipe(
                        Effect.map((author) => ({
                          id: comment.id,
                          body: comment.body,
                          createdAt: comment.createdAt.toISOString(),
                          url: comment.url,
                          author:
                            author === undefined ? undefined : { id: author.id, name: author.name },
                        })),
                      ),
                    { concurrency: 4 },
                  );

            const relations =
              outboundRelations === undefined || inboundRelations === undefined
                ? undefined
                : yield* Effect.forEach(
                    outboundRelations
                      .map(
                        (
                          relation,
                        ): {
                          readonly relation: typeof relation;
                          readonly direction: "outbound" | "inbound";
                        } => ({ relation, direction: "outbound" }),
                      )
                      .concat(
                        inboundRelations.map((relation) => ({
                          relation,
                          direction: "inbound" as const,
                        })),
                      ),
                    ({ direction, relation }) =>
                      resolveLinearFetch(
                        direction === "outbound" ? relation.relatedIssue : relation.issue,
                      ).pipe(
                        Effect.flatMap((relatedIssue) =>
                          relatedIssue === undefined
                            ? Effect.succeed(undefined)
                            : Effect.succeed({
                                id: relation.id,
                                type: relation.type,
                                direction,
                                issue: toIssueReference(relatedIssue),
                              }),
                        ),
                      ),
                    { concurrency: 4 },
                  ).pipe(
                    Effect.map((items) =>
                      items.filter((item): item is NonNullable<typeof item> => item !== undefined),
                    ),
                  );

            return {
              id: issue.id,
              identifier: issue.identifier,
              title: issue.title,
              url: issue.url,
              description: issue.description ?? undefined,
              branchName: issue.branchName,
              priority: { value: issue.priority, label: issue.priorityLabel },
              state:
                state === undefined
                  ? undefined
                  : { id: state.id, name: state.name, type: state.type },
              team:
                team === undefined ? undefined : { id: team.id, key: team.key, name: team.name },
              assignee:
                assignee === undefined
                  ? undefined
                  : { id: assignee.id, name: assignee.name, email: assignee.email },
              project:
                project === undefined
                  ? undefined
                  : { id: project.id, name: project.name, url: project.url },
              parent: parent === undefined ? undefined : toIssueReference(parent),
              labels: labels.map((label) => ({ id: label.id, name: label.name })),
              children: children?.map(toIssueReference),
              comments: detailedComments,
              relations,
            } satisfies IssueDetails;
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
        (input: {
          title: string;
          teamId: string;
          description?: string;
          parentId?: string;
          projectId?: string;
          priority?: number;
        }) =>
          Effect.gen(function* () {
            const client = yield* getClient;
            const payload = yield* Effect.tryPromise({
              try: () =>
                client.createIssue({
                  title: input.title,
                  teamId: input.teamId,
                  description: input.description,
                  parentId: input.parentId,
                  projectId: input.projectId,
                  priority: input.priority,
                }),
              catch: (e) => LinearApiError.make({ message: String(e) }),
            });
            const issueFetch = payload.issue;
            if (issueFetch === undefined) {
              return yield* LinearApiError.make({ message: "Failed to create issue" });
            }
            return yield* Effect.tryPromise({
              try: () => issueFetch,
              catch: (e) => LinearApiError.make({ message: String(e) }),
            });
          }),
      );

      const createComment = Effect.fn("LinearService.createComment")(
        (issueId: string, body: string) =>
          Effect.gen(function* () {
            const client = yield* getClient;
            const payload = yield* Effect.tryPromise({
              try: () => client.createComment({ issueId: normalizeIssueId(issueId), body }),
              catch: (error) => LinearApiError.make({ message: String(error) }),
            });
            const comment = yield* resolveLinearFetch(payload.comment);
            return comment === undefined
              ? yield* LinearApiError.make({ message: "Linear did not return the created comment" })
              : { id: comment.id, url: comment.url };
          }),
      );

      const rawQuery = Effect.fn("LinearService.rawQuery")(
        (query: string, variables: Readonly<Record<string, unknown>>) =>
          Effect.gen(function* () {
            const client = yield* getClient;
            const response = yield* Effect.tryPromise({
              try: () =>
                client.client.rawRequest<unknown, Record<string, unknown>>(query, variables),
              catch: (error) => LinearApiError.make({ message: String(error) }),
            });
            return response.data;
          }),
      );

      return LinearService.of({
        getViewer,
        getTeams,
        getProjects,
        getIssues,
        getMyIssues,
        getIssue,
        getIssueDetails,
        updateIssueState,
        createIssue,
        createComment,
        rawQuery,
      });
    }),
  );

  static readonly layerTest = (options?: {
    viewer?: User;
    teams?: readonly Team[];
    issues?: readonly Issue[];
  }) =>
    Layer.succeed(LinearService, {
      getViewer:
        options?.viewer !== undefined
          ? Effect.succeed(options.viewer)
          : Effect.fail(LinearApiError.make({ message: "No viewer in test" })),
      getTeams: Effect.succeed(options?.teams ?? []),
      getProjects: Effect.succeed([]),
      getIssues: (_filter) => Effect.succeed(options?.issues ?? []),
      getMyIssues: (_filter) => Effect.succeed(options?.issues ?? []),
      getIssue: (id) => {
        const issue = options?.issues?.find((i) => i.id === id || i.identifier === id);
        return issue !== undefined
          ? Effect.succeed(issue)
          : Effect.fail(LinearApiError.make({ message: `Issue ${id} not found` }));
      },
      getIssueDetails: (id, _options) => {
        const issue = options?.issues?.find(
          (candidate) => candidate.id === id || candidate.identifier === id,
        );
        return issue === undefined
          ? Effect.fail(LinearApiError.make({ message: `Issue ${id} not found` }))
          : Effect.succeed({
              id: issue.id,
              identifier: issue.identifier,
              title: issue.title,
              url: issue.url,
              description: issue.description ?? undefined,
              branchName: issue.branchName,
              priority: { value: issue.priority, label: issue.priorityLabel },
              labels: [],
            });
      },
      updateIssueState: (_issueId, _stateId) => Effect.void,
      createIssue: (_input) =>
        Effect.fail(LinearApiError.make({ message: "Not implemented in test" })),
      createComment: (_issueId, _body) =>
        Effect.fail(LinearApiError.make({ message: "Not implemented in test" })),
      rawQuery: (_query, _variables) =>
        Effect.fail(LinearApiError.make({ message: "Not implemented in test" })),
    });
}

const normalizeIssueId = (input: string): string => {
  const match = input.match(/\/issue\/([A-Za-z]+-\d+)(?:\/|$)/);
  return match?.[1] ?? input;
};

const toIssueReference = (issue: Issue): IssueReference => ({
  id: issue.id,
  identifier: issue.identifier,
  title: issue.title,
  url: issue.url,
});

const resolveLinearFetch = <T>(
  fetch: PromiseLike<T> | undefined,
): Effect.Effect<T | undefined, LinearApiError> =>
  fetch === undefined
    ? Effect.succeed<T | undefined>(undefined)
    : Effect.tryPromise({
        try: () => Promise.resolve(fetch),
        catch: (error) => LinearApiError.make({ message: String(error) }),
      });

const loadConnection = <T>(load: () => PromiseLike<{ readonly nodes: ReadonlyArray<T> }>) =>
  Effect.tryPromise({
    try: () => Promise.resolve(load()),
    catch: (error) => LinearApiError.make({ message: String(error) }),
  }).pipe(Effect.map((connection) => connection.nodes));
