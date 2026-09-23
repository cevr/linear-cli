import { describe, expect, it } from "@effect/vitest";
import { layer as BunServicesLayer } from "@effect/platform-bun/BunServices";
import { Effect, FileSystem, Layer, Path, Redacted, Ref } from "effect";
import { TestConsole } from "effect/testing";
import { runCli } from "../src/cli.js";
import {
  extractUploadLinks,
  fileNameFromContentDisposition,
  toSafeFileName,
  withUniqueSuffix,
} from "../src/domain/Files.js";
import { UploadUrl } from "../src/domain/Linear.js";
import { ConfigService } from "../src/services/Config.js";
import { fetchUpload, LinearService } from "../src/services/Linear.js";

const uploadA = "https://uploads.linear.app/org/a/file-a";
const uploadB = "https://uploads.linear.app/org/b/file-b";

const issueWithUploads = (id: string) =>
  Effect.succeed({
    id,
    identifier: "TEST-1",
    title: "Files",
    url: "https://linear.app/issue/TEST-1",
    branchName: "test-1",
    priority: { value: 0, label: "No priority" },
    labels: [],
    description: `Spec: [Spec.pdf](${uploadA})`,
    comments: [
      {
        id: "comment-1",
        body: `New table ![Table (1).jpg](${uploadB}) and again [Spec.pdf](${uploadA})`,
        createdAt: "2026-09-23T00:00:00.000Z",
        url: "https://linear.app/comment/comment-1",
      },
    ],
  });

const testLayer = Layer.mergeAll(ConfigService.layerTest(), TestConsole.layer, BunServicesLayer);

describe("upload helpers", () => {
  it("extracts Markdown links and images that point at Linear uploads", () => {
    expect(
      extractUploadLinks(
        `[a.pdf](${uploadA}) ![b.jpg](<${uploadB}>) [elsewhere](https://example.com/x)`,
        "description",
      ).map((file) => [file.name, file.url]),
    ).toEqual([
      ["a.pdf", uploadA],
      ["b.jpg", uploadB],
    ]);
  });

  it("keeps file names inside the output directory", () => {
    expect(toSafeFileName("../../etc/passwd")).toBe("passwd");
    expect(toSafeFileName("..\\secret.txt")).toBe("secret.txt");
    expect(toSafeFileName(".env")).toBe("env");
    expect(toSafeFileName("..")).toBe("download");
    expect(toSafeFileName("Nutrition & Allergen.pdf")).toBe("Nutrition _ Allergen.pdf");
  });

  it("suffixes names already used in the same run", () => {
    expect(withUniqueSuffix("a.pdf", new Set(["a.pdf", "a-2.pdf"]))).toBe("a-3.pdf");
    expect(withUniqueSuffix("notes", new Set(["notes"]))).toBe("notes-2");
  });

  it("reads plain and encoded Content-Disposition names", () => {
    expect(fileNameFromContentDisposition('attachment; filename="Spec.pdf"')).toBe("Spec.pdf");
    expect(fileNameFromContentDisposition("attachment; filename*=UTF-8''Men%C3%BA.pdf")).toBe(
      "Menú.pdf",
    );
    expect(fileNameFromContentDisposition(null)).toBeUndefined();
  });
});

// Fetch fakes must return a promise; build it through Effect.
const response = (body: BodyInit | null, init: ResponseInit): Promise<Response> =>
  Effect.runPromise(Effect.succeed(new Response(body, init)));

describe("fetchUpload", () => {
  it.effect("sends the key to the upload host but not to the redirect target", () =>
    Effect.gen(function* () {
      const requests: Array<{ url: string; authorization: string | null }> = [];
      const fakeFetch = (input: string | URL, init?: RequestInit): Promise<Response> => {
        requests.push({
          url: String(input),
          authorization: new Headers(init?.headers).get("authorization"),
        });
        if (requests.length === 1) {
          return response(null, {
            status: 302,
            headers: { location: "https://storage.example.com/signed?sig=1" },
          });
        }
        return response("pdf-bytes", {
          headers: {
            "content-type": "application/pdf",
            "content-disposition": 'attachment; filename="Spec.pdf"',
          },
        });
      };

      const file = yield* fetchUpload(UploadUrl.make(uploadA), Redacted.make("lin_key"), fakeFetch);

      expect(requests).toEqual([
        { url: uploadA, authorization: "lin_key" },
        { url: "https://storage.example.com/signed?sig=1", authorization: null },
      ]);
      expect(new TextDecoder().decode(file.bytes)).toBe("pdf-bytes");
      expect(file.fileName).toBe("Spec.pdf");
    }),
  );

  it.effect("fails with a tagged error on a non-success status", () =>
    Effect.gen(function* () {
      const fakeFetch = (): Promise<Response> => response(null, { status: 404 });
      const result = yield* fetchUpload(
        UploadUrl.make(uploadA),
        Redacted.make("lin_key"),
        fakeFetch,
      ).pipe(Effect.result);

      expect(result._tag).toBe("Failure");
      if (result._tag === "Failure") {
        expect(result.failure._tag).toBe("LinearApiError");
      }
    }),
  );
});

describe("linear file download", () => {
  it.effect("rejects URLs outside the upload host before sending the key", () =>
    Effect.gen(function* () {
      const called = yield* Ref.make(false);
      const result = yield* runCli([
        "file",
        "download",
        "https://evil.example.com/uploads.linear.app/x",
      ]).pipe(
        Effect.provide(
          LinearService.layerTest({
            downloadFile: () => Ref.set(called, true).pipe(Effect.as({ bytes: new Uint8Array() })),
          }),
        ),
        Effect.result,
      );

      expect(result._tag).toBe("Failure");
      if (result._tag === "Failure") {
        expect(result.failure._tag).toBe("InvalidInputError");
      }
      expect(yield* Ref.get(called)).toBe(false);
    }).pipe(Effect.provide(testLayer)),
  );
});

describe("linear issue files", () => {
  it.effect("lists uploads from the description and comments once each", () =>
    Effect.gen(function* () {
      yield* runCli(["issue", "files", "TEST-1", "--json"]).pipe(
        Effect.provide(LinearService.layerTest({ getIssueDetails: issueWithUploads })),
      );

      const lines = yield* TestConsole.logLines;
      expect(lines).toEqual([
        `[{"name":"Spec.pdf","url":"${uploadA}","source":"description"},{"name":"Table (1).jpg","url":"${uploadB}","source":"comment-1"}]`,
      ]);
    }).pipe(Effect.provide(testLayer)),
  );

  it.effect("saves uploads under their Markdown names and refuses to overwrite", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const outputDir = yield* fileSystem.makeTempDirectoryScoped();
        const linearLayer = LinearService.layerTest({
          getIssueDetails: issueWithUploads,
          downloadFile: (url) => Effect.succeed({ bytes: new TextEncoder().encode(url) }),
        });
        const args = ["issue", "files", "TEST-1", "--download", "--output-dir", outputDir];

        yield* runCli(args).pipe(Effect.provide(linearLayer));

        expect(yield* fileSystem.readFileString(path.join(outputDir, "Spec.pdf"))).toBe(uploadA);
        expect(yield* fileSystem.readFileString(path.join(outputDir, "Table (1).jpg"))).toBe(
          uploadB,
        );

        const again = yield* runCli(args).pipe(Effect.provide(linearLayer), Effect.result);
        expect(again._tag).toBe("Failure");

        yield* runCli([...args, "--overwrite"]).pipe(Effect.provide(linearLayer));
      }),
    ).pipe(Effect.provide(testLayer)),
  );
});
