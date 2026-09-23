import { Argument, Command } from "effect/unstable/cli";
import { Console, Effect } from "effect";
import type { SavedFile } from "../domain/Linear.js";
import { parseUploadUrl } from "../domain/Input.js";
import { saveDownloads } from "../lib/downloads.js";
import { InvalidInputError } from "../lib/errors.js";
import { jsonFlag, outputDirFlag, overwriteFlag } from "../lib/flags.js";
import { encodeJson } from "../lib/json.js";

const uploadUrlsArg = Argument.string("url").pipe(
  Argument.withDescription("https://uploads.linear.app/... URL (repeat for several files)"),
  Argument.variadic(),
);

export const logSavedFiles = (savedFiles: ReadonlyArray<SavedFile>, json: boolean) =>
  Effect.gen(function* () {
    if (json) {
      yield* Console.log(encodeJson(savedFiles));
      return;
    }
    for (const savedFile of savedFiles) {
      yield* Console.log(`Saved ${savedFile.path} (${savedFile.bytes} bytes)`);
    }
  });

// linear file download <url>... - Download files uploaded to Linear
export const fileDownloadCommand = Command.make(
  "download",
  { urls: uploadUrlsArg, outputDir: outputDirFlag, overwrite: overwriteFlag, json: jsonFlag },
  ({ urls, outputDir, overwrite, json }) =>
    Effect.gen(function* () {
      if (urls.length === 0) {
        return yield* InvalidInputError.make({
          message:
            "Upload URL required. Usage: linear file download https://uploads.linear.app/... --json",
        });
      }
      const uploadUrls = yield* Effect.forEach(urls, parseUploadUrl);
      const savedFiles = yield* saveDownloads({
        requests: uploadUrls.map((url) => ({ url })),
        outputDir,
        overwrite,
      });
      yield* logSavedFiles(savedFiles, json);
    }),
).pipe(
  Command.withDescription("Download files uploaded to Linear with the configured credential"),
  Command.withExamples([
    {
      command: "linear file download https://uploads.linear.app/... --output-dir ./files --json",
      description: "Save one upload and print its path as JSON",
    },
  ]),
);

export const file = Command.make("file", {}, () =>
  Console.log("Use 'linear file download <url>' to download an upload. See --help for more."),
).pipe(
  Command.withDescription("Download files uploaded to Linear"),
  Command.withSubcommands([fileDownloadCommand]),
);
