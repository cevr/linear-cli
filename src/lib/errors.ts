import { Schema } from "effect";

export class ConfigError extends Schema.TaggedErrorClass<ConfigError>()("ConfigError", {
  message: Schema.String,
}) {}

export class LinearApiError extends Schema.TaggedErrorClass<LinearApiError>()("LinearApiError", {
  message: Schema.String,
  code: Schema.optional(Schema.String),
}) {}

export class TokenNotFoundError extends Schema.TaggedErrorClass<TokenNotFoundError>()(
  "TokenNotFoundError",
  {
    message: Schema.String,
  },
) {
  static readonly default = TokenNotFoundError.make({
    message: "No token found. Run 'linear auth' to authenticate.",
  });
}

export class InvalidTokenError extends Schema.TaggedErrorClass<InvalidTokenError>()(
  "InvalidTokenError",
  {
    message: Schema.String,
  },
) {}

export class NoIssuesError extends Schema.TaggedErrorClass<NoIssuesError>()("NoIssuesError", {
  message: Schema.String,
}) {
  static readonly default = NoIssuesError.make({ message: "No issues found to select from." });
}

export class InvalidInputError extends Schema.TaggedErrorClass<InvalidInputError>()(
  "InvalidInputError",
  {
    message: Schema.String,
  },
) {}
