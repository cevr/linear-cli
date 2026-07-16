import { Console, Effect, FileSystem, Option, Path, Schema } from "effect";
import { Command, Flag } from "effect/unstable/cli";
import { Kind, parse } from "graphql";
import { InvalidInputError } from "../lib/errors.js";
import { encodeJson } from "../lib/json.js";
import { LinearService } from "../services/Linear.js";

const queryOption = Flag.string("query").pipe(
  Flag.withDescription("GraphQL document"),
  Flag.optional,
);

const queryFileOption = Flag.string("query-file").pipe(
  Flag.withDescription("Read the GraphQL document from a file"),
  Flag.optional,
);

const variablesOption = Flag.string("variables").pipe(
  Flag.withDescription("GraphQL variables as a JSON object"),
  Flag.withDefault("{}"),
);

const allowMutationOption = Flag.boolean("allow-mutation").pipe(
  Flag.withDescription("Explicitly authorize a raw GraphQL mutation"),
);

const VariablesJson = Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown));
const decodeVariables = Schema.decodeUnknownEffect(VariablesJson);
const maximumInputLength = 1_000_000;

const containsMutation = Effect.fn("ApiCommand.containsMutation")(function* (document: string) {
  const parsed = yield* Effect.try({
    try: () => parse(document),
    catch: (error) =>
      InvalidInputError.make({ message: `Invalid GraphQL document: ${String(error)}` }),
  });
  return parsed.definitions.some(
    (definition) =>
      definition.kind === Kind.OPERATION_DEFINITION && definition.operation === "mutation",
  );
});

const readWorkspaceQueryFile = Effect.fn("ApiCommand.readWorkspaceQueryFile")(function* (
  requestedPath: string,
) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const workspace = yield* fileSystem.realPath(path.resolve("."));
  const queryFile = yield* fileSystem.realPath(path.resolve(requestedPath));
  const relative = path.relative(workspace, queryFile);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    return yield* InvalidInputError.make({
      message: `--query-file must stay within the current workspace: ${requestedPath}`,
    });
  }
  const document = yield* fileSystem.readFileString(queryFile);
  if (document.length > maximumInputLength) {
    return yield* InvalidInputError.make({
      message: `GraphQL query files cannot exceed ${maximumInputLength} characters`,
    });
  }
  return document;
});

export const graphqlCommand = Command.make(
  "graphql",
  {
    query: queryOption,
    queryFile: queryFileOption,
    variables: variablesOption,
    allowMutation: allowMutationOption,
  },
  ({ query, queryFile, variables, allowMutation }) =>
    Effect.gen(function* () {
      if (Option.isSome(query) && Option.isSome(queryFile)) {
        return yield* InvalidInputError.make({
          message: "Use exactly one of --query or --query-file",
        });
      }

      const document = yield* Option.match(query, {
        onSome: Effect.succeed,
        onNone: () =>
          Option.match(queryFile, {
            onNone: () =>
              InvalidInputError.make({ message: "--query or --query-file is required" }),
            onSome: (path) =>
              readWorkspaceQueryFile(path).pipe(
                Effect.mapError((error) =>
                  error._tag === "InvalidInputError"
                    ? error
                    : InvalidInputError.make({
                        message: `Could not read GraphQL query file ${path}: ${error}`,
                      }),
                ),
              ),
          }),
      });
      if (document.length > maximumInputLength) {
        return yield* InvalidInputError.make({
          message: `GraphQL documents cannot exceed ${maximumInputLength} characters`,
        });
      }
      if (variables.length > maximumInputLength) {
        return yield* InvalidInputError.make({
          message: `--variables cannot exceed ${maximumInputLength} characters`,
        });
      }
      if ((yield* containsMutation(document)) && !allowMutation) {
        return yield* InvalidInputError.make({
          message:
            "Raw GraphQL mutations require explicit authorization with --allow-mutation. Preview and inspect the document before retrying.",
        });
      }
      const parsedVariables = yield* decodeVariables(variables).pipe(
        Effect.mapError((error) =>
          InvalidInputError.make({ message: `--variables must be a JSON object: ${error}` }),
        ),
      );
      const linear = yield* LinearService;
      const data = yield* linear.rawQuery(document, parsedVariables);
      yield* Console.log(encodeJson(data));
    }),
).pipe(
  Command.withDescription("Execute an authenticated Linear GraphQL operation"),
  Command.withExamples([
    {
      command: 'linear api graphql --query "query { viewer { id name } }"',
      description: "Run an inline GraphQL query",
    },
    {
      command: "linear api graphql --query-file query.graphql --variables '{}'",
      description: "Run a GraphQL query from a file with variables",
    },
    {
      command: "linear api graphql --query-file mutation.graphql --allow-mutation",
      description: "Explicitly authorize a raw GraphQL mutation",
    },
  ]),
);

export const api = Command.make("api", {}, () =>
  Console.log("Use 'linear api graphql' for GraphQL operations not covered by typed commands."),
).pipe(
  Command.withDescription("Access the Linear GraphQL API"),
  Command.withSubcommands([graphqlCommand]),
);
