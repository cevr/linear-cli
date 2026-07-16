import { LinearClient } from "@linear/sdk";
import type { Issue, IssueRelation as SdkIssueRelation, User } from "@linear/sdk";
import { Context, Effect, Layer, Redacted } from "effect";
import type {
  CreateIssueInput,
  CreatedIssue,
  IssueDetails,
  IssueDetailsOptions,
  IssueReference,
  IssueSelector,
  IssueSummary,
  Project,
  StartedIssue,
  Team,
  Viewer,
} from "../domain/Linear.js";
import type { ConfigError, TokenNotFoundError } from "../lib/errors.js";
import { InvalidInputError, InvalidTokenError, LinearApiError } from "../lib/errors.js";
import { ConfigService } from "./Config.js";

type LinearError = ConfigError | InvalidTokenError | LinearApiError | TokenNotFoundError;

interface LinearOperations {
  readonly authenticate: (token: Redacted.Redacted<string>) => Effect.Effect<Viewer, LinearError>;
  readonly getViewer: Effect.Effect<Viewer, LinearError>;
  readonly getTeams: Effect.Effect<readonly Team[], LinearError>;
  readonly getProjects: Effect.Effect<readonly Project[], LinearError>;
  readonly getMyIssues: (filter?: {
    readonly state?: string;
    readonly limit?: number;
  }) => Effect.Effect<readonly IssueSummary[], LinearError>;
  readonly getIssueDetails: (
    id: IssueSelector,
    options: IssueDetailsOptions,
  ) => Effect.Effect<IssueDetails, LinearError>;
  readonly startIssue: (
    id: IssueSelector,
    options: { readonly dryRun: boolean },
  ) => Effect.Effect<StartedIssue, LinearError | InvalidInputError>;
  readonly createIssue: (input: CreateIssueInput) => Effect.Effect<CreatedIssue, LinearError>;
  readonly createComment: (
    issueId: IssueSelector,
    body: string,
  ) => Effect.Effect<{ readonly id: string; readonly url: string }, LinearError>;
  readonly rawQuery: (
    query: string,
    variables: Readonly<Record<string, unknown>>,
  ) => Effect.Effect<unknown, LinearError>;
}

export class LinearService extends Context.Service<LinearService, LinearOperations>()(
  "@cvr/linear/services/Linear/LinearService",
) {
  static readonly layer = Layer.effect(
    LinearService,
    Effect.gen(function* () {
      const config = yield* ConfigService;
      const getClient = yield* Effect.cached(
        config.getToken.pipe(
          Effect.map((token) => new LinearClient({ apiKey: Redacted.value(token) })),
        ),
      );

      const withClient = <A>(
        operation: (client: LinearClient) => PromiseLike<A>,
      ): Effect.Effect<A, LinearError> =>
        getClient.pipe(
          Effect.flatMap((client) =>
            Effect.tryPromise({
              try: () => Promise.resolve(operation(client)),
              catch: toLinearError,
            }),
          ),
        );

      const authenticate = Effect.fn("LinearService.authenticate")(function* (
        token: Redacted.Redacted<string>,
      ) {
        const client = new LinearClient({ apiKey: Redacted.value(token) });
        const viewer = yield* Effect.tryPromise({
          try: () => client.viewer,
          catch: toLinearError,
        });
        yield* config.saveToken(token);
        return toViewer(viewer);
      });

      const getViewer = withClient((client) => client.viewer).pipe(
        Effect.map(toViewer),
        Effect.withSpan("LinearService.getViewer"),
      );

      const getTeams = withClient((client) => client.teams()).pipe(
        Effect.map((connection) => connection.nodes.map(toTeam)),
        Effect.withSpan("LinearService.getTeams"),
      );

      const getProjects = withClient((client) => client.projects()).pipe(
        Effect.map((connection) => connection.nodes.map(toProject)),
        Effect.withSpan("LinearService.getProjects"),
      );

      const getMyIssues = Effect.fn("LinearService.getMyIssues")(function* (filter?: {
        readonly state?: string;
        readonly limit?: number;
      }) {
        const viewer = yield* withClient((client) => client.viewer);
        const connection = yield* resolveLinearFetch(
          viewer.assignedIssues({
            first: filter?.limit ?? 50,
            filter:
              filter?.state === undefined ? undefined : { state: { type: { eq: filter.state } } },
          }),
        );
        return yield* Effect.forEach(connection.nodes, toIssueSummary, { concurrency: 4 });
      });

      const getIssue = (id: IssueSelector) => withClient((client) => client.issue(id));

      const getIssueDetails = Effect.fn("LinearService.getIssueDetails")(function* (
        id: IssueSelector,
        options: IssueDetailsOptions,
      ) {
        const issue = yield* getIssue(id);
        const [summary, team, assignee, project, parent, labels] = yield* Effect.all([
          toIssueSummary(issue),
          resolveOptionalFetch(issue.team),
          resolveOptionalFetch(issue.assignee),
          resolveOptionalFetch(issue.project),
          resolveOptionalFetch(issue.parent),
          loadConnection(() => issue.labels()),
        ]);

        const children = options.children
          ? yield* loadConnection(() => issue.children())
          : undefined;
        const comments = options.comments
          ? yield* loadConnection(() => issue.comments())
          : undefined;
        const outbound = options.relations
          ? yield* loadConnection(() => issue.relations())
          : undefined;
        const inbound = options.relations
          ? yield* loadConnection(() => issue.inverseRelations())
          : undefined;

        const detailedComments =
          comments === undefined
            ? undefined
            : yield* Effect.forEach(
                comments,
                (comment) =>
                  resolveOptionalFetch(comment.user).pipe(
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
          outbound === undefined || inbound === undefined
            ? undefined
            : yield* Effect.forEach(
                outbound
                  .map<{
                    readonly relation: SdkIssueRelation;
                    readonly direction: "outbound" | "inbound";
                  }>((relation) => ({ relation, direction: "outbound" }))
                  .concat(inbound.map((relation) => ({ relation, direction: "inbound" }))),
                Effect.fn("LinearService.resolveRelation")(function* ({ direction, relation }) {
                  const related = yield* resolveOptionalFetch(
                    direction === "outbound" ? relation.relatedIssue : relation.issue,
                  );
                  return related === undefined
                    ? undefined
                    : {
                        id: relation.id,
                        type: relation.type,
                        direction,
                        issue: toIssueReference(related),
                      };
                }),
                { concurrency: 4 },
              ).pipe(
                Effect.map((items) =>
                  items.filter((item): item is NonNullable<typeof item> => item !== undefined),
                ),
              );

        return {
          id: summary.id,
          identifier: summary.identifier,
          title: summary.title,
          url: summary.url,
          branchName: summary.branchName,
          priority: summary.priority,
          state: summary.state,
          description: issue.description ?? undefined,
          team: team === undefined ? undefined : { id: team.id, key: team.key, name: team.name },
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
      });

      const startIssue = Effect.fn("LinearService.startIssue")(function* (
        id: IssueSelector,
        options: { readonly dryRun: boolean },
      ) {
        const issue = yield* getIssue(id);
        const team = yield* resolveOptionalFetch(issue.team);
        if (team === undefined) {
          return yield* InvalidInputError.make({
            message: `Issue ${issue.identifier} is not associated with a team`,
          });
        }
        const states = yield* loadConnection(() => team.states());
        const started = states.find(
          (state) => state.type === "started" || state.name.toLowerCase() === "in progress",
        );
        if (started === undefined) {
          return yield* InvalidInputError.make({
            message: `No started state exists for team ${team.key}`,
          });
        }
        if (!options.dryRun) {
          yield* withClient((client) => client.updateIssue(issue.id, { stateId: started.id }));
        }
        return {
          issue: toIssueReference(issue),
          state: { id: started.id, name: started.name, type: started.type },
          branchName: issue.branchName,
        };
      });

      const createIssue = Effect.fn("LinearService.createIssue")(function* (
        input: CreateIssueInput,
      ) {
        const parentId =
          input.parent === undefined ? undefined : (yield* getIssue(input.parent)).id;
        const payload = yield* withClient((client) =>
          client.createIssue({
            title: input.title,
            teamId: input.teamId,
            description: input.description,
            parentId,
            projectId: input.projectId,
            priority: input.priority,
          }),
        );
        if (payload.issue === undefined) {
          return yield* LinearApiError.make({ message: "Linear did not return the created issue" });
        }
        return toIssueReference(yield* resolveLinearFetch(payload.issue));
      });

      const createComment = Effect.fn("LinearService.createComment")(function* (
        issueId: IssueSelector,
        body: string,
      ) {
        const payload = yield* withClient((client) => client.createComment({ issueId, body }));
        const comment = yield* resolveOptionalFetch(payload.comment);
        return comment === undefined
          ? yield* LinearApiError.make({ message: "Linear did not return the created comment" })
          : { id: comment.id, url: comment.url };
      });

      const rawQuery = Effect.fn("LinearService.rawQuery")(function* (
        query: string,
        variables: Readonly<Record<string, unknown>>,
      ) {
        const response = yield* withClient((client) =>
          client.client.rawRequest<unknown, Record<string, unknown>>(query, variables),
        );
        return response.data;
      });

      return LinearService.of({
        authenticate,
        getViewer,
        getTeams,
        getProjects,
        getMyIssues,
        getIssueDetails,
        startIssue,
        createIssue,
        createComment,
        rawQuery,
      });
    }),
  );

  static readonly layerTest = (overrides: Partial<LinearOperations> = {}) =>
    Layer.succeed(
      LinearService,
      Object.assign(
        {
          authenticate: (token) =>
            Effect.succeed({
              id: "viewer",
              name: "Test User",
              email: `${Redacted.value(token)}@example.com`,
              admin: false,
            }),
          getViewer: Effect.succeed({
            id: "viewer",
            name: "Test User",
            email: "test@example.com",
            admin: false,
          }),
          getTeams: Effect.succeed([]),
          getProjects: Effect.succeed([]),
          getMyIssues: () => Effect.succeed([]),
          getIssueDetails: (id) =>
            Effect.succeed({
              id,
              identifier: id,
              title: "Test issue",
              url: `https://linear.app/issue/${id}`,
              branchName: id.toLowerCase(),
              priority: { value: 0, label: "No priority" },
              labels: [],
            }),
          startIssue: (id) =>
            Effect.succeed({
              issue: {
                id,
                identifier: id,
                title: "Test issue",
                url: `https://linear.app/issue/${id}`,
              },
              state: { id: "started", name: "In Progress", type: "started" },
              branchName: id.toLowerCase(),
            }),
          createIssue: (input) =>
            Effect.succeed({
              id: "created",
              identifier: "TEST-1",
              title: input.title,
              url: "https://linear.app/issue/TEST-1",
            }),
          createComment: () =>
            Effect.succeed({ id: "comment", url: "https://linear.app/comment/comment" }),
          rawQuery: () => Effect.succeed({}),
        } satisfies LinearOperations,
        overrides,
      ),
    );
}

const toLinearError = (error: unknown): InvalidTokenError | LinearApiError => {
  const message = String(error);
  return message.includes("Authentication") || message.includes("401")
    ? InvalidTokenError.make({ message: "Invalid API token" })
    : LinearApiError.make({ message });
};

const toViewer = (viewer: User): Viewer => ({
  id: viewer.id,
  name: viewer.name,
  email: viewer.email,
  admin: viewer.admin,
  status:
    viewer.statusEmoji === undefined && viewer.statusLabel === undefined
      ? undefined
      : {
          emoji: viewer.statusEmoji ?? undefined,
          label: viewer.statusLabel ?? undefined,
        },
});

const toTeam = (team: Awaited<ReturnType<LinearClient["team"]>>): Team => ({
  id: team.id,
  key: team.key,
  name: team.name,
  description: team.description ?? undefined,
});

const toProject = (project: Awaited<ReturnType<LinearClient["project"]>>): Project => ({
  id: project.id,
  name: project.name,
  slug: project.slugId,
  state: project.state,
  url: project.url,
});

const toIssueReference = (issue: Issue): IssueReference => ({
  id: issue.id,
  identifier: issue.identifier,
  title: issue.title,
  url: issue.url,
});

const toIssueSummary = Effect.fn("LinearService.toIssueSummary")(function* (
  issue: Issue,
): Effect.fn.Return<IssueSummary, LinearApiError> {
  const state = yield* resolveOptionalFetch(issue.state);
  return {
    id: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    url: issue.url,
    branchName: issue.branchName,
    priority: { value: issue.priority, label: issue.priorityLabel },
    state: state === undefined ? undefined : { id: state.id, name: state.name, type: state.type },
  };
});

const resolveLinearFetch = <T>(fetch: PromiseLike<T>): Effect.Effect<T, LinearApiError> =>
  Effect.tryPromise({
    try: () => Promise.resolve(fetch),
    catch: (error) => LinearApiError.make({ message: String(error) }),
  });

const resolveOptionalFetch = <T>(
  fetch: PromiseLike<T> | undefined,
): Effect.Effect<T | undefined, LinearApiError> =>
  fetch === undefined ? Effect.succeed(undefined) : resolveLinearFetch(fetch);

const loadConnection = <T>(load: () => PromiseLike<{ readonly nodes: ReadonlyArray<T> }>) =>
  resolveLinearFetch(load()).pipe(Effect.map((connection) => connection.nodes));
