// A deterministic public-schema fixture world. No owner data is used.
export function world(seed = 1) {
  let state = seed >>> 0;
  const random = () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0);
  const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const user = {
    id: uuid(1),
    name: "Pilot User",
    email: "pilot@example.invalid",
    admin: false,
    statusEmoji: seed % 2 ? null : ":satellite:",
    statusLabel: seed % 2 ? null : "Available",
  };
  const states = [
    { id: uuid(2), name: "Todo", type: "unstarted" },
    { id: uuid(3), name: "In Progress", type: "started" },
  ];
  const teams = [
    { id: uuid(4), key: "ENG", name: "Engineering", description: "General tools" },
    { id: uuid(5), key: "OPS", name: "Operations", description: null },
  ];
  const projects = [
    {
      id: uuid(6),
      name: "Router",
      slugId: "router",
      state: "started",
      url: "https://linear.app/project/router",
    },
    {
      id: uuid(7),
      name: "Relay",
      slugId: "relay",
      state: "planned",
      url: "https://linear.app/project/relay",
    },
  ];
  for (let i = 0; i < (seed >>> 1) % 3; i++) {
    teams.push({ id: uuid(40 + i), key: `NET${i}`, name: `Network ${i}`, description: null });
  }
  for (let i = 0; i < (seed >>> 2) % 2; i++) {
    projects.push({
      id: uuid(50 + i),
      name: `Tools ${i}`,
      slugId: `tools-${i}`,
      state: "planned",
      url: `https://linear.app/project/tools-${i}`,
    });
  }
  const issues = Array.from({ length: 2 + (random() % 5) }, (_, i) => ({
    id: uuid(10 + i),
    identifier: `ENG-${123 + i}`,
    title:
      i === 0 ? "Route a packet" : `${["Relay", "Café 🚀", "x".repeat(72)][random() % 3]} ${i}`,
    url: `https://linear.app/issue/ENG-${123 + i}`,
    branchName: `eng-${123 + i}-route`,
    priority: random() % 5,
    priorityLabel: "",
    description: i % 2 ? null : "[trace.txt](https://uploads.linear.app/trace.txt)",
    state: states[i % 2]!,
    team: teams[0],
    assignee: i % 2 ? null : user,
    project: i % 3 ? null : projects[0],
    parent: null as Record<string, unknown> | null,
  }));
  const labels = Array.from({ length: seed >= 1000 ? seed % 7 : 1 }, (_, i) => ({
    id: uuid(30 + i),
    name: `tooling${i || ""}`,
  }));
  const comments = [
    {
      id: uuid(31),
      body: "[log.txt](https://uploads.linear.app/log.txt)",
      createdAt: "2026-01-01T00:00:00.000Z",
      url: "https://linear.app/comment/pilot",
      user: user as typeof user | null,
    },
  ];
  if (seed >= 1000) {
    comments.length = 0;
    for (let i = 0; i < seed % 6; i++)
      comments.push({
        id: uuid(100 + i),
        body: `[trace-${i}.txt](https://uploads.linear.app/trace-${i}.txt)`,
        createdAt: "2026-01-01T00:00:00.000Z",
        url: `https://linear.app/comment/${i}`,
        user: i % 2 ? null : user,
      });
    for (let i = 1; i < issues.length; i++) if (i % 2) issues[i]!.parent = issues[0]!;
  }
  for (const issue of issues)
    issue.priorityLabel = ["No priority", "Urgent", "High", "Medium", "Low"][issue.priority]!;
  if (seed % 2 === 0) issues[1]!.parent = issues[0]!;
  const relations = [{ id: uuid(32), type: "blocks", issue: issues[0], relatedIssue: issues[1] }];
  if (seed >= 1000) {
    relations.length = 0;
    for (let i = 1; i < issues.length; i++) {
      relations.push({
        id: uuid(200 + i),
        type: "blocks",
        issue: issues[0],
        relatedIssue: issues[i],
      });
      relations.push({
        id: uuid(300 + i),
        type: "related",
        issue: issues[i],
        relatedIssue: issues[0],
      });
    }
  }
  return {
    seed,
    user,
    states,
    teams,
    projects,
    issues,
    labels,
    comments,
    relations,
    pageSize: 1 + (seed % 3),
  };
}
export type World = ReturnType<typeof world>;
