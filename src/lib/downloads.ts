import { Effect, FileSystem, Path } from "effect";
import { toSafeFileName, withUniqueSuffix } from "../domain/Files.js";
import { SavedFile } from "../domain/Linear.js";
import type { DownloadedFile, UploadUrl } from "../domain/Linear.js";
import { LinearService } from "../services/Linear.js";
import { FileWriteError, InvalidInputError } from "./errors.js";

export interface DownloadRequest {
  readonly url: UploadUrl;
  /** The name the Markdown link gave the file, when there is one. */
  readonly name?: string;
}

const toFileWriteError = (error: unknown): FileWriteError =>
  FileWriteError.make({ message: String(error) });

const nonEmpty = (value: string | undefined): string | undefined => {
  if (value === undefined || value.trim().length === 0) {
    return undefined;
  }
  return value;
};

const preferredFileName = (request: DownloadRequest, download: DownloadedFile): string =>
  nonEmpty(request.name) ??
  nonEmpty(download.fileName) ??
  new URL(request.url).pathname.split("/").pop() ??
  "download";

export const saveDownloads = Effect.fn("saveDownloads")(function* (options: {
  readonly requests: ReadonlyArray<DownloadRequest>;
  readonly outputDir: string;
  readonly overwrite: boolean;
}) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const linear = yield* LinearService;

  yield* fileSystem
    .makeDirectory(options.outputDir, { recursive: true })
    .pipe(Effect.mapError(toFileWriteError));

  const takenNames = new Set<string>();
  const savedFiles: Array<SavedFile> = [];
  for (const request of options.requests) {
    const download = yield* linear.downloadFile(request.url);
    const fileName = withUniqueSuffix(
      toSafeFileName(preferredFileName(request, download)),
      takenNames,
    );
    takenNames.add(fileName);
    const target = path.join(options.outputDir, fileName);

    const exists = yield* fileSystem.exists(target).pipe(Effect.mapError(toFileWriteError));
    if (exists && !options.overwrite) {
      return yield* InvalidInputError.make({
        message: `${target} already exists. Pass --overwrite to replace it.`,
      });
    }
    yield* fileSystem.writeFile(target, download.bytes).pipe(Effect.mapError(toFileWriteError));
    savedFiles.push(
      SavedFile.make({
        url: request.url,
        path: target,
        bytes: download.bytes.byteLength,
        contentType: download.contentType,
      }),
    );
  }
  return savedFiles;
});
