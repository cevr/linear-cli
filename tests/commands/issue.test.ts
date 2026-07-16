import { describe, expect, it } from "@effect/vitest";
import { layer as BunServicesLayer } from "@effect/platform-bun/BunServices";
import { Effect } from "effect";
import { TestConsole } from "effect/testing";
import { Command } from "effect/unstable/cli";
import { issueCommentCommand } from "../../src/commands/issue.js";
import { LinearService } from "../../src/services/Linear.js";

describe("linear issue comment", () => {
  it.effect("prints a machine-readable plan without performing the mutation", () =>
    Effect.gen(function* () {
      const run = Command.runWith(issueCommentCommand, { version: "test" });

      yield* run(["BITE-123", "--body", "Ready for review", "--dry-run"]);

      const lines = yield* TestConsole.logLines;
      expect(lines).toHaveLength(1);
      expect(lines[0]).toBe(
        '{"dryRun":true,"operation":"issue.comment","input":{"id":"BITE-123","body":"Ready for review"}}',
      );
    }).pipe(
      Effect.provide(LinearService.layerTest()),
      Effect.provide(TestConsole.layer),
      Effect.provide(BunServicesLayer),
    ),
  );
});
