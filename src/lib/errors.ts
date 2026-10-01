import { Schema } from "effect";

export class ConfigError extends Schema.TaggedError<ConfigError>()("ConfigError", {
  message: Schema.String,
}) {}

export class LinearApiError extends Schema.TaggedError<LinearApiError>()("LinearApiError", {
  message: Schema.String,
  code: Schema.optional(Schema.String),
}) {}

export class TokenNotFoundError extends Schema.TaggedError<TokenNotFoundError>()(
  "TokenNotFoundError",
  {
    message: Schema.String,
  },
) {
  static readonly default = TokenNotFoundError.make({
    message: "No token found. Run 'linear auth' to authenticate.",
  });
}

export class InvalidTokenError extends Schema.TaggedError<InvalidTokenError>()(
  "InvalidTokenError",
  {
    message: Schema.String,
  },
) {}

export class NoIssuesError extends Schema.TaggedError<NoIssuesError>()("NoIssuesError", {
  message: Schema.String,
}) {
  static readonly default = NoIssuesError.make({ message: "No issues found to select from." });
}

export class InvalidInputError extends Schema.TaggedError<InvalidInputError>()(
  "InvalidInputError",
  {
    message: Schema.String,
  },
) {}

export class FileWriteError extends Schema.TaggedError<FileWriteError>()("FileWriteError", {
  message: Schema.String,
}) {}
