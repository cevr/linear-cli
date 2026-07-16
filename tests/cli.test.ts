import { describe, expect, it } from "@effect/vitest";
import { layer as BunServicesLayer } from "@effect/platform-bun/BunServices";
import { Effect } from "effect";
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
});
