import { fakeLinear } from "./fake-linear";
import { world } from "./world";

// Observe the public GraphQL response, not the fake's resolver implementation.
// The fixture collections are the independent membership model.
export async function checkRootLookups(seed: number) {
  for (const next of [seed, seed + 1, seed + 2]) {
    const w = world(next);
    const roots = {
      issue: w.issues,
      user: [w.user],
      team: w.teams,
      project: w.projects,
      workflowState: w.states,
      comment: w.comments,
      issueRelation: w.relations,
    };
    const fake = fakeLinear(w);
    try {
      for (const [root, members] of Object.entries(roots)) {
        const ids = [
          ...members.map((m) => m.id),
          `00000000-0000-4000-8000-${String(900000 + next).padStart(12, "0")}`,
        ];
        if (root === "issue") ids.push("ENG-123", `ENG-${900000 + next}`);
        for (const id of ids) {
          const member = members.find(
            (m) => m.id === id || ("identifier" in m && m.identifier === id),
          );
          const response = await fetch(`${fake.origin}/graphql`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: "pilot-test-token" },
            body: JSON.stringify({
              query: `query($id: String!) { ${root}(id: $id) { id } }`,
              variables: { id },
            }),
          });
          const result = (await response.json()) as {
            data?: Record<string, { id: string }> | null;
            errors?: { message: string; path: string[] }[];
          };
          const good = member
            ? !result.errors && result.data?.[root]?.id === member.id
            : result.data === null &&
              result.errors?.some(
                (e) => e.path?.[0] === root && e.message.includes("Cannot return null"),
              );
          if (!good)
            throw new Error(
              `fake-invents-missing-root: seed=${next} root=${root} id=${id} member=${Boolean(member)} response=${JSON.stringify(result)}; replay: bun parity/run.ts --regressions=L0 --seed=${seed}`,
            );
        }
      }
    } finally {
      await fake.close();
    }
  }
  console.log("ok root membership property");
}
