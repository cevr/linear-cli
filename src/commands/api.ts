import { Console, Effect, FileSystem, Option, Schema } from "effect";
import { Command, Flag } from "effect/unstable/cli";
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

const VariablesJson = Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown));
const decodeVariables = Schema.decodeUnknownEffect(VariablesJson);

export const graphqlCommand = Command.make(
  "graphql",
  { query: queryOption, queryFile: queryFileOption, variables: variablesOption },
  ({ query, queryFile, variables }) =>
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
              FileSystem.FileSystem.use((fileSystem) =>
                fileSystem.readFileString(path).pipe(
                  Effect.mapError((error) =>
                    InvalidInputError.make({
                      message: `Could not read GraphQL query file ${path}: ${error}`,
                    }),
                  ),
                ),
              ),
          }),
      });
      const parsedVariables = yield* decodeVariables(variables).pipe(
        Effect.mapError((error) =>
          InvalidInputError.make({ message: `--variables must be a JSON object: ${error}` }),
        ),
      );
      const linear = yield* LinearService;
      const data = yield* linear.rawQuery(document, parsedVariables);
      yield* Console.log(encodeJson(data));
    }),
);

export const api = Command.make("api", {}, () =>
  Console.log("Use 'linear api graphql' for GraphQL operations not covered by typed commands."),
).pipe(Command.withSubcommands([graphqlCommand]));
