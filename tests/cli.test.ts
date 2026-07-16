import { describe, expect, it } from "@effect/vitest";
import { layer as BunServicesLayer } from "@effect/platform-bun/BunServices";
import { Effect, FileSystem, Path, Ref } from "effect";
import { TestConsole } from "effect/testing";
import { runCli } from "../src/cli.js";
import { ConfigService } from "../src/services/Config.js";
import { LinearService } from "../src/services/Linear.js";

describe("linear CLI", () => {
  it.effect("keeps issue list JSON free of human output", () =>
    Effect.gen(function* () {
      yield* runCli(["issue", "list", "--json"]);

      const lines = yield* TestConsole.logLines;
      expect(lines).toHaveLength(1);
      expect(lines[0]).toBe(
        '[{"id":"issue-1","identifier":"TEST-1","title":"Agent-safe output","url":"https://linear.app/issue/TEST-1","branchName":"test-1-agent-safe-output","priority":{"value":2,"label":"High"},"state":{"id":"started","name":"In Progress","type":"started"}}]',
      );
    }).pipe(
      Effect.provide(
        LinearService.layerTest({
          getMyIssues: () =>
            Effect.succeed([
              {
                id: "issue-1",
                identifier: "TEST-1",
                title: "Agent-safe output",
                url: "https://linear.app/issue/TEST-1",
                branchName: "test-1-agent-safe-output",
                priority: { value: 2, label: "High" },
                state: { id: "started", name: "In Progress", type: "started" },
              },
            ]),
        }),
      ),
      Effect.provide(ConfigService.layerTest()),
      Effect.provide(TestConsole.layer),
      Effect.provide(BunServicesLayer),
    ),
  );

  it.effect("requires explicit interactive mode when an issue identifier is missing", () =>
    Effect.gen(function* () {
      const result = yield* runCli(["issue", "view", "--json"]).pipe(Effect.result);

      expect(result._tag).toBe("Failure");
      if (result._tag === "Failure") {
        expect(result.failure._tag).toBe("InvalidInputError");
      }
    }).pipe(
      Effect.provide(LinearService.layerTest()),
      Effect.provide(ConfigService.layerTest()),
      Effect.provide(TestConsole.layer),
      Effect.provide(BunServicesLayer),
    ),
  );

  it.effect("previews issue starts without mutating", () =>
    Effect.gen(function* () {
      const observedDryRun = yield* Ref.make(false);
      const program = runCli(["issue", "start", "TEST-1", "--dry-run"]);

      yield* program.pipe(
        Effect.provide(
          LinearService.layerTest({
            startIssue: (id, options) =>
              Ref.set(observedDryRun, options.dryRun).pipe(
                Effect.as({
                  issue: {
                    id,
                    identifier: id,
                    title: "Safe preview",
                    url: `https://linear.app/issue/${id}`,
                  },
                  state: { id: "started", name: "In Progress", type: "started" },
                  branchName: "test-1-safe-preview",
                }),
              ),
          }),
        ),
      );

      expect(yield* Ref.get(observedDryRun)).toBe(true);
      const lines = yield* TestConsole.logLines;
      expect(lines).toEqual([
        '{"dryRun":true,"operation":"issue.start","input":{"id":"TEST-1"},"result":{"issue":{"id":"TEST-1","identifier":"TEST-1","title":"Safe preview","url":"https://linear.app/issue/TEST-1"},"state":{"id":"started","name":"In Progress","type":"started"},"branchName":"test-1-safe-preview"}}',
      ]);
    }).pipe(
      Effect.provide(ConfigService.layerTest()),
      Effect.provide(TestConsole.layer),
      Effect.provide(BunServicesLayer),
    ),
  );

  it.effect("validates create input before loading remote choices", () =>
    Effect.gen(function* () {
      const loadedTeams = yield* Ref.make(false);
      const result = yield* runCli(["issue", "create", "--dry-run"]).pipe(
        Effect.provide(
          LinearService.layerTest({
            getTeams: Ref.set(loadedTeams, true).pipe(Effect.as([])),
          }),
        ),
        Effect.result,
      );

      expect(result._tag).toBe("Failure");
      expect(yield* Ref.get(loadedTeams)).toBe(false);
    }).pipe(
      Effect.provide(ConfigService.layerTest()),
      Effect.provide(TestConsole.layer),
      Effect.provide(BunServicesLayer),
    ),
  );

  it.effect("rejects malformed selectors before calling Linear", () =>
    Effect.gen(function* () {
      const called = yield* Ref.make(false);
      const result = yield* runCli(["issue", "view", "TEST-1?fields=name", "--json"]).pipe(
        Effect.provide(
          LinearService.layerTest({
            getIssueDetails: (id) =>
              Ref.set(called, true).pipe(
                Effect.andThen(Effect.die(`unexpected Linear call for ${id}`)),
              ),
          }),
        ),
        Effect.result,
      );

      expect(result._tag).toBe("Failure");
      expect(yield* Ref.get(called)).toBe(false);
    }).pipe(
      Effect.provide(ConfigService.layerTest()),
      Effect.provide(TestConsole.layer),
      Effect.provide(BunServicesLayer),
    ),
  );

  it.effect("rejects query-file symlinks that escape the workspace", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const outside = yield* fileSystem.makeTempFileScoped({ suffix: ".graphql" });
        yield* fileSystem.writeFileString(outside, "query { viewer { id } }");
        const link = path.join(
          path.resolve("."),
          `.linear-query-test-${crypto.randomUUID()}.graphql`,
        );
        yield* Effect.acquireRelease(fileSystem.symlink(outside, link), () =>
          fileSystem.remove(link).pipe(Effect.orDie),
        );

        const called = yield* Ref.make(false);
        const result = yield* runCli(["api", "graphql", "--query-file", link]).pipe(
          Effect.provide(
            LinearService.layerTest({
              rawQuery: () => Ref.set(called, true).pipe(Effect.as({})),
            }),
          ),
          Effect.result,
        );

        expect(result._tag).toBe("Failure");
        expect(yield* Ref.get(called)).toBe(false);
      }),
    ).pipe(
      Effect.provide(ConfigService.layerTest()),
      Effect.provide(TestConsole.layer),
      Effect.provide(BunServicesLayer),
    ),
  );

  it.effect("requires explicit authorization for raw GraphQL mutations", () =>
    Effect.gen(function* () {
      const called = yield* Ref.make(false);
      const mutation = 'mutation { issueArchive(id: "TEST-1") { success } }';
      const result = yield* runCli(["api", "graphql", "--query", mutation]).pipe(
        Effect.provide(
          LinearService.layerTest({
            rawQuery: () => Ref.set(called, true).pipe(Effect.as({})),
          }),
        ),
        Effect.result,
      );

      expect(result._tag).toBe("Failure");
      expect(yield* Ref.get(called)).toBe(false);
    }).pipe(
      Effect.provide(ConfigService.layerTest()),
      Effect.provide(TestConsole.layer),
      Effect.provide(BunServicesLayer),
    ),
  );

  it.effect("runs an explicitly authorized raw GraphQL mutation", () =>
    Effect.gen(function* () {
      const mutation = 'mutation { issueArchive(id: "TEST-1") { success } }';
      yield* runCli(["api", "graphql", "--query", mutation, "--allow-mutation"]).pipe(
        Effect.provide(
          LinearService.layerTest({
            rawQuery: () => Effect.succeed({ issueArchive: { success: true } }),
          }),
        ),
      );

      expect(yield* TestConsole.logLines).toEqual(['{"issueArchive":{"success":true}}']);
    }).pipe(
      Effect.provide(ConfigService.layerTest()),
      Effect.provide(TestConsole.layer),
      Effect.provide(BunServicesLayer),
    ),
  );

  it.effect("rejects invalid list limits before calling Linear", () =>
    Effect.gen(function* () {
      const called = yield* Ref.make(false);
      const result = yield* runCli(["issue", "list", "--limit", "0", "--json"]).pipe(
        Effect.provide(
          LinearService.layerTest({
            getMyIssues: () => Ref.set(called, true).pipe(Effect.as([])),
          }),
        ),
        Effect.result,
      );

      expect(result._tag).toBe("Failure");
      expect(yield* Ref.get(called)).toBe(false);
    }).pipe(
      Effect.provide(ConfigService.layerTest()),
      Effect.provide(TestConsole.layer),
      Effect.provide(BunServicesLayer),
    ),
  );
});
