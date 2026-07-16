import { Effect } from "effect";
import { IssueSelector } from "./Linear.js";
import { InvalidInputError } from "../lib/errors.js";

const issueIdentifierPattern = /^[A-Za-z][A-Za-z0-9]*-\d+$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hasUnsupportedControlCharacter = (value: string): boolean =>
  Array.from(value).some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code === 0x7f || (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d);
  });

export const parseIssueSelector = Effect.fn("Input.parseIssueSelector")(function* (input: string) {
  if (hasUnsupportedControlCharacter(input)) {
    return yield* InvalidInputError.make({
      message: "Issue identifiers cannot contain control characters",
    });
  }

  const urlMatch = input.match(
    /^https:\/\/linear\.app\/[^/]+\/issue\/([A-Za-z][A-Za-z0-9]*-\d+)(?:\/[^?#]*)?$/i,
  );
  if (urlMatch?.[1] !== undefined) {
    return IssueSelector.make(urlMatch[1]);
  }
  if (issueIdentifierPattern.test(input) || uuidPattern.test(input)) {
    return IssueSelector.make(input);
  }

  return yield* InvalidInputError.make({
    message: `Invalid issue identifier: ${input}. Expected ENG-123, a Linear issue URL, or a UUID`,
  });
});

export const validateText = Effect.fn("Input.validateText")(function* (options: {
  readonly name: string;
  readonly value: string;
  readonly maximumLength: number;
  readonly allowEmpty?: boolean;
}) {
  if (hasUnsupportedControlCharacter(options.value)) {
    return yield* InvalidInputError.make({
      message: `${options.name} cannot contain control characters`,
    });
  }
  if (options.allowEmpty !== true && options.value.trim().length === 0) {
    return yield* InvalidInputError.make({ message: `${options.name} cannot be empty` });
  }
  if (options.value.length > options.maximumLength) {
    return yield* InvalidInputError.make({
      message: `${options.name} cannot exceed ${options.maximumLength} characters`,
    });
  }
  return options.value;
});
