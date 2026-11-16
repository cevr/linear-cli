import { fakeLinear, mutationReferences } from "./fake-linear";
import type { EntityType } from "./fake-linear";
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
  await checkMutationReferences(seed);
}

type World = ReturnType<typeof world>;
type Reply = {
  data?: Record<string, unknown> | null;
  errors?: { message: string; path?: string[]; extensions?: Record<string, unknown> }[];
};
type Probe = { mutation: string; document: string; variables: Record<string, unknown> };
type Reference = { field: string; type: EntityType; make: (w: World, id: string) => Probe };

const inputTypes = {
  issueCreate: "IssueCreateInput",
  issueUpdate: "IssueUpdateInput",
  commentCreate: "CommentCreateInput",
};
// The smallest valid input of each mutation, built from members only.
const baseInputs: Record<keyof typeof mutationReferences, (w: World) => Record<string, unknown>> = {
  issueCreate: (w) => ({ title: "Probe", teamId: w.teams[0]!.id }),
  issueUpdate: () => ({}),
  commentCreate: (w) => ({ issueId: w.issues[0]!.id, body: "Probe" }),
};

// Every entity reference a mutation takes: each modelled input field, plus
// the id argument of issueUpdate and issueArchive.
function references(): Reference[] {
  const all: Reference[] = [];
  for (const [mutation, fields] of Object.entries(mutationReferences) as [
    keyof typeof mutationReferences,
    Record<string, EntityType>,
  ][]) {
    const update = mutation === "issueUpdate";
    for (const [field, type] of Object.entries(fields))
      all.push({
        field: `${mutation}.${field}`,
        type,
        make: (w, id) => {
          const input = { ...baseInputs[mutation](w), [field]: field.endsWith("Ids") ? [id] : id };
          return {
            mutation,
            document: `mutation(${update ? "$id: String!, " : ""}$input: ${inputTypes[mutation]}!) { ${mutation}(${update ? "id: $id, " : ""}input: $input) { success } }`,
            variables: update ? { id: w.issues[0]!.id, input } : { input },
          };
        },
      });
  }
  all.push(
    {
      field: "issueUpdate.id",
      type: "Issue",
      make: (_, id) => ({
        mutation: "issueUpdate",
        document: "mutation($id: String!) { issueUpdate(id: $id, input: {}) { success } }",
        variables: { id },
      }),
    },
    {
      field: "issueArchive.id",
      type: "Issue",
      make: (_, id) => ({
        mutation: "issueArchive",
        document: "mutation($id: String!) { issueArchive(id: $id) { success } }",
        variables: { id },
      }),
    },
  );
  return all;
}

// A nonmember is Linear's input error, with no recorded mutation and an
// unchanged world; a member is accepted and recorded once.
function answered(
  member: boolean,
  type: EntityType,
  mutation: string,
  status: number,
  result: Reply,
  recorded: number,
  unchanged: boolean,
): boolean {
  if (member) return status === 200 && !result.errors && recorded === 1;
  const error = result.errors?.[0];
  return (
    status === 200 &&
    result.data === null &&
    error?.message === `Entity not found: ${type}` &&
    error.path?.[0] === mutation &&
    error.extensions?.type === "invalid input" &&
    error.extensions?.statusCode === 400 &&
    error.extensions?.userPresentableMessage === `Could not find referenced ${type}.` &&
    recorded === 0 &&
    unchanged
  );
}

// Every mutation input that names an entity, generated over member and
// nonmember ids against the same fixture membership model.
async function checkMutationReferences(seed: number) {
  for (const next of [seed, seed + 1, seed + 2]) {
    const probe = world(next);
    const members: Record<EntityType, { id: string; identifier?: string }[]> = {
      Issue: probe.issues,
      Team: probe.teams,
      Project: probe.projects,
      WorkflowState: probe.states,
      User: [probe.user],
      IssueLabel: probe.labels,
      Comment: probe.comments,
    };
    let state = next >>> 0;
    const pick = <T>(xs: T[]) => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return xs[state % xs.length]!;
    };
    const missing = (type: EntityType) =>
      pick([
        `00000000-0000-4000-8000-${String(900000 + next).padStart(12, "0")}`,
        `${pick(members[type]).id}-gone`,
        ...(type === "Issue" ? [`ENG-${900000 + next}`] : []),
      ]);
    const present = (type: EntityType) => {
      const m = pick(members[type]);
      return type === "Issue" && m.identifier && state % 2 ? m.identifier : m.id;
    };
    for (const ref of references()) {
      if (!members[ref.type].length) continue;
      for (const member of [true, false]) {
        const id = member ? present(ref.type) : missing(ref.type);
        const w = world(next);
        const fake = fakeLinear(w);
        const before = JSON.stringify(w);
        const { mutation, document, variables } = ref.make(w, id);
        try {
          const response = await fetch(`${fake.origin}/graphql`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: "pilot-test-token" },
            body: JSON.stringify({ query: document, variables }),
          });
          const result = (await response.json()) as Reply;
          const unchanged = JSON.stringify(w) === before;
          if (
            !answered(
              member,
              ref.type,
              mutation,
              response.status,
              result,
              fake.mutations.length,
              unchanged,
            )
          )
            throw new Error(
              `fake-mutates-missing-reference: seed=${next} field=${ref.field} id=${id} member=${member} status=${response.status} response=${JSON.stringify(result)} mutations=${JSON.stringify(fake.mutations)}; replay: bun parity/run.ts --regressions=L0 --seed=${seed}`,
            );
        } finally {
          await fake.close();
        }
      }
    }
  }
  console.log("ok mutation reference property");
}
