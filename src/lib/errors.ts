import { Schema } from "effect";

export class ConfigError extends Schema.TaggedError<
  ConfigError,
  { readonly brand: unique symbol }
>()("ConfigError", {
  message: Schema.String,
}) {}

export class LinearApiError extends Schema.TaggedError<
  LinearApiError,
  { readonly brand: unique symbol }
>()("LinearApiError", {
  message: Schema.String,
  code: Schema.optional(Schema.String),
}) {}

export class TokenNotFoundError extends Schema.TaggedError<
  TokenNotFoundError,
  { readonly brand: unique symbol }
>()("TokenNotFoundError", {
  message: Schema.String,
}) {
  static readonly default = TokenNotFoundError.make({
    message: "No token found. Run 'linear auth' to authenticate.",
  });
}

export class InvalidTokenError extends Schema.TaggedError<
  InvalidTokenError,
  { readonly brand: unique symbol }
>()("InvalidTokenError", {
  message: Schema.String,
}) {}

export class NoIssuesError extends Schema.TaggedError<
  NoIssuesError,
  { readonly brand: unique symbol }
>()("NoIssuesError", {
  message: Schema.String,
}) {
  static readonly default = NoIssuesError.make({ message: "No issues found to select from." });
}

export class InvalidInputError extends Schema.TaggedError<
  InvalidInputError,
  { readonly brand: unique symbol }
>()("InvalidInputError", {
  message: Schema.String,
}) {}

export class FileWriteError extends Schema.TaggedError<
  FileWriteError,
  { readonly brand: unique symbol }
>()("FileWriteError", {
  message: Schema.String,
}) {}
