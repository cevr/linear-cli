import { LinearClient } from "@linear/sdk";
import type { Comment, Issue, IssueRelation as SdkIssueRelation, User } from "@linear/sdk";
import { Context, Effect, Layer, Redacted } from "effect";
import type {
  CreateIssueInput,
  CreatedIssue,
  IssueComment,
  IssueDetails,
  IssueDetailsOptions,
  IssueReference,
  IssueRelation,
  IssueSelector,
  IssueSummary,
  Project,
  StartedIssue,
  Team,
  Viewer,
} from "../domain/Linear.js";
import type { ConfigError, TokenNotFoundError } from "../lib/errors.js";
import { InvalidInputError, InvalidTokenError, LinearApiError } from "../lib/errors.js";
import { succeedUndefined } from "../lib/effect.js";
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
              try: () => operation(client),
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
        Effect.flatMap(loadAllPages),
        Effect.map((teams) => teams.map(toTeam)),
        Effect.withSpan("LinearService.getTeams"),
      );

      const getProjects = withClient((client) => client.projects()).pipe(
        Effect.flatMap(loadAllPages),
        Effect.map((projects) => projects.map(toProject)),
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
            filter: toStateFilter(filter?.state),
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

        const children = yield* loadConnectionWhen(options.children, () => issue.children());
        const comments = yield* loadConnectionWhen(options.comments, () => issue.comments());
        const outbound = yield* loadConnectionWhen(options.relations, () => issue.relations());
        const inbound = yield* loadConnectionWhen(options.relations, () =>
          issue.inverseRelations(),
        );

        const detailedComments = yield* toDetailedComments(comments);
        const relations = yield* toRelations(outbound, inbound);

        return {
          id: summary.id,
          identifier: summary.identifier,
          title: summary.title,
          url: summary.url,
          branchName: summary.branchName,
          priority: summary.priority,
          state: summary.state,
          description: issue.description ?? undefined,
          team: mapDefined(team, (value) => ({ id: value.id, key: value.key, name: value.name })),
          assignee: mapDefined(assignee, (value) => ({
            id: value.id,
            name: value.name,
            email: value.email,
          })),
          project: mapDefined(project, (value) => ({
            id: value.id,
            name: value.name,
            url: value.url,
          })),
          parent: mapDefined(parent, toIssueReference),
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

      const resolveParentId = Effect.fn("LinearService.resolveParentId")(function* (
        parent: IssueSelector | undefined,
      ) {
        if (parent === undefined) {
          return undefined;
        }
        const parentIssue = yield* getIssue(parent);
        return parentIssue.id;
      });

      const createIssue = Effect.fn("LinearService.createIssue")(function* (
        input: CreateIssueInput,
      ) {
        const parentId = yield* resolveParentId(input.parent);
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
        if (comment === undefined) {
          return yield* LinearApiError.make({
            message: "Linear did not return the created comment",
          });
        }
        return { id: comment.id, url: comment.url };
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
  if (message.includes("Authentication") || message.includes("401")) {
    return InvalidTokenError.make({ message: "Invalid API token" });
  }
  return LinearApiError.make({ message });
};

const mapDefined = <T, U>(value: T | undefined, transform: (value: T) => U): U | undefined => {
  if (value === undefined) {
    return undefined;
  }
  return transform(value);
};

const toViewerStatus = (viewer: User): Viewer["status"] => {
  if (viewer.statusEmoji === undefined && viewer.statusLabel === undefined) {
    return undefined;
  }
  return {
    emoji: viewer.statusEmoji ?? undefined,
    label: viewer.statusLabel ?? undefined,
  };
};

const toViewer = (viewer: User): Viewer => ({
  id: viewer.id,
  name: viewer.name,
  email: viewer.email,
  admin: viewer.admin,
  status: toViewerStatus(viewer),
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
    state: mapDefined(state, (value) => ({ id: value.id, name: value.name, type: value.type })),
  };
});

const resolveLinearFetch = <T>(fetch: PromiseLike<T>): Effect.Effect<T, LinearApiError> =>
  Effect.tryPromise({
    try: () => fetch,
    catch: (error) => LinearApiError.make({ message: String(error) }),
  });

const resolveOptionalFetch = <T>(
  fetch: PromiseLike<T> | undefined,
): Effect.Effect<T | undefined, LinearApiError> => {
  if (fetch === undefined) {
    return succeedUndefined;
  }
  return resolveLinearFetch(fetch);
};

const toStateFilter = (
  state: string | undefined,
): { readonly state: { readonly type: { readonly eq: string } } } | undefined => {
  if (state === undefined) {
    return undefined;
  }
  return { state: { type: { eq: state } } };
};

const toCommentAuthor = (author: User | undefined): IssueComment["author"] => {
  if (author === undefined) {
    return undefined;
  }
  return { id: author.id, name: author.name };
};

const toDetailedComments = (
  comments: ReadonlyArray<Comment> | undefined,
): Effect.Effect<ReadonlyArray<IssueComment> | undefined, LinearApiError> => {
  if (comments === undefined) {
    return succeedUndefined;
  }
  return Effect.forEach(
    comments,
    (comment) =>
      resolveOptionalFetch(comment.user).pipe(
        Effect.map((author) => ({
          id: comment.id,
          body: comment.body,
          createdAt: comment.createdAt.toISOString(),
          url: comment.url,
          author: toCommentAuthor(author),
        })),
      ),
    { concurrency: 4 },
  );
};

interface RelationWithDirection {
  readonly relation: SdkIssueRelation;
  readonly direction: "outbound" | "inbound";
}

const relatedIssueFetch = (entry: RelationWithDirection): PromiseLike<Issue> | undefined => {
  if (entry.direction === "outbound") {
    return entry.relation.relatedIssue;
  }
  return entry.relation.issue;
};

const toRelations = (
  outbound: ReadonlyArray<SdkIssueRelation> | undefined,
  inbound: ReadonlyArray<SdkIssueRelation> | undefined,
): Effect.Effect<ReadonlyArray<IssueRelation> | undefined, LinearApiError> => {
  if (outbound === undefined || inbound === undefined) {
    return succeedUndefined;
  }
  const entries = outbound
    .map<RelationWithDirection>((relation) => ({ relation, direction: "outbound" }))
    .concat(inbound.map((relation) => ({ relation, direction: "inbound" })));
  return Effect.forEach(
    entries,
    Effect.fn("LinearService.resolveRelation")(function* ({ direction, relation }) {
      const related = yield* resolveOptionalFetch(relatedIssueFetch({ direction, relation }));
      if (related === undefined) {
        return undefined;
      }
      return {
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
};

const loadConnectionWhen = <T>(
  enabled: boolean,
  load: () => PromiseLike<PaginatedConnection<T>>,
): Effect.Effect<ReadonlyArray<T> | undefined, LinearApiError> => {
  if (!enabled) {
    return succeedUndefined;
  }
  return loadConnection(load);
};

interface PaginatedConnection<T> {
  readonly nodes: ReadonlyArray<T>;
  readonly pageInfo: { readonly hasNextPage: boolean };
  readonly fetchNext: () => PromiseLike<PaginatedConnection<T>>;
}

const loadAllPages = Effect.fn("LinearService.loadAllPages")(function* <T>(
  initial: PaginatedConnection<T>,
) {
  let connection = initial;
  while (connection.pageInfo.hasNextPage) {
    connection = yield* resolveLinearFetch(connection.fetchNext());
  }
  return connection.nodes;
});

const loadConnection = <T>(load: () => PromiseLike<PaginatedConnection<T>>) =>
  resolveLinearFetch(load()).pipe(Effect.flatMap(loadAllPages));
