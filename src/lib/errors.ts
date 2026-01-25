import { Schema } from "effect";

export class ConfigError extends Schema.TaggedError<ConfigError>()("ConfigError", {
  message: Schema.String,
}) {}

export class LinearApiError extends Schema.TaggedError<LinearApiError>()("LinearApiError", {
  message: Schema.String,
  code: Schema.optional(Schema.String),
}) {}

export class BrowserError extends Schema.TaggedError<BrowserError>()("BrowserError", {
  message: Schema.String,
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

export const AppError = Schema.Union(
  ConfigError,
  LinearApiError,
  BrowserError,
  TokenNotFoundError,
  InvalidTokenError,
  NoIssuesError,
);
export type AppError = typeof AppError.Type;
