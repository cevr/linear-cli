// Mutants run only in generated copies under the pilot's own scratch folder.
import { spawn, spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const scratch = "/tmp/opencode/linear-port";
const compiler = join(scratch, "ergo");
await mkdir(scratch, { recursive: true });
const env = {
  PATH: process.env.PATH ?? "/usr/bin:/bin",
  HOME: scratch,
  GOMAXPROCS: "1",
  GOMEMLIMIT: "6GiB",
  GOFLAGS: "-p=1",
  GOCACHE: join(scratch, "gocache"),
  GOPATH: join(scratch, "go"),
  GOMODCACHE: join(scratch, "go/pkg/mod"),
};

async function run(command: string, args: string[], cwd: string) {
  const child = spawn(command, args, {
    cwd,
    env,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "",
    active = true;
  let force: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    if (active && child.pid) {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        /* already reaped */
      }
      force ??= setTimeout(() => {
        if (active && child.pid) {
          try {
            process.kill(-child.pid, "SIGKILL");
          } catch {
            /* already reaped */
          }
        }
      }, 10_000);
    }
  };
  const timer = setTimeout(stop, 120_000); // only a hung mutant is stopped
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) process.on(signal, stop);
  child.stdout.on("data", (data) => {
    output += data;
  });
  child.stderr.on("data", (data) => {
    output += data;
  });
  try {
    const code = await new Promise<number>((ok, fail) => {
      child.once("error", fail);
      child.once("close", (status, signal) =>
        signal ? fail(new Error(`mutant stopped: ${signal}`)) : ok(status ?? 1),
      );
    });
    return { code, output };
  } finally {
    stop();
    active = false;
    clearTimeout(timer);
    if (force) clearTimeout(force);
    for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) process.off(signal, stop);
    const ps = spawnSync("ps", ["-eo", "pid,pgid,stat,comm"], { encoding: "utf8" });
    const remains = ps.stdout.split("\n").filter((line) => {
      const fields = line.trim().split(/\s+/);
      return fields[1] === String(child.pid) && !fields[2]?.startsWith("Z");
    });
    if (remains.length) console.error(`owned processes remain: ${remains.join("; ")}`);
    if (remains.length || ps.status !== 0) process.exitCode = 1;
  }
}

type Mutant = {
  name: string;
  file: string;
  from: string;
  to: string;
  pkg: string;
  guard: string;
  args?: string[];
};
const mutants: Mutant[] = [
  {
    name: "graphql-rejects-schema-definition",
    file: "graphql/schema.ergo",
    from: 'if token.Text == "schema" {',
    to: "if false {",
    pkg: "graphql",
    guard: "FAIL law MutationIsAnOperation",
  },
  {
    name: "create-machine-accepts-blank-title",
    file: "linear/write.ergo",
    from: 'let text = try ValidateText("Issue title", title.Text, 255, false)',
    to: "let text = title.Text",
    pkg: "linear",
    guard: "law refuted",
  },
  {
    name: "graphql-string-is-mutation",
    file: "graphql/document.ergo",
    from: "let mut mutation = false",
    to: 'let mut mutation = strings.Contains(text, "mutation")',
    pkg: "graphql",
    guard: "law refuted",
  },
  {
    name: "graphql-skips-later-operation",
    file: "graphql/document.ergo",
    from: 'mutation = mutation || token.Text == "mutation"',
    to: 'mutation = mutation || (count == 0 && token.Text == "mutation")',
    pkg: "graphql",
    guard: "law refuted",
  },
  {
    name: "dry-run-sends-mutation",
    file: "cli/write.ergo",
    from: "let started = try linear.PlanStart(id)",
    to: "let started = try linear.PlanStart(id)\n\ttry linear.Writer.Start(started.Issue.Id, started.State.Id)",
    pkg: "",
    guard: "dry-run-sends-mutation survived",
    args: ["--phase=3", "--case=start-dry"],
  },
  {
    name: "workspace-allows-symlink-escape",
    file: "cli/graphql.ergo",
    from: 'if relative == ".." || strings.HasPrefix(relative, "../") || filepath.IsAbs(relative) {',
    to: 'if (relative == ".." || strings.HasPrefix(relative, "../") || filepath.IsAbs(relative)) && false {',
    pkg: "",
    guard: "expected exit 1, got 0",
    args: ["--phase=3", "--case=graphql-file-escape"],
  },
  {
    name: "memory-keeps-empty-identity",
    file: "memory/tracker.ergo",
    from: 'if team.Id != "" && team.Key != "" {',
    to: "if true {",
    pkg: "memory",
    guard: "law refuted",
  },
  {
    name: "http-accepts-empty-team-identity",
    file: "graphqlhttp/client.ergo",
    from: 'if n.Id == "" || n.Key == "" {',
    to: "if false {",
    pkg: "graphqlhttp",
    guard: "law refuted",
  },
  {
    name: "http-stops-at-first-page",
    file: "graphqlhttp/client.ergo",
    from: "if !data.Teams.PageInfo.HasNextPage {",
    to: "if true {",
    pkg: "",
    guard: "parity mismatch",
  },
  {
    name: "selector-url-loses-key",
    file: "linear/selector.ergo",
    from: "return Selector{value: parts[2]}",
    to: 'return Selector{value: "WRONG-1"}',
    pkg: "linear",
    guard: "law refuted",
  },
  {
    name: "issue-connection-first-page",
    file: "graphqlhttp/issue.ergo",
    from: "if !data.Issue.Items.PageInfo.HasNextPage {",
    to: "if true {",
    pkg: "",
    guard: "parity mismatch",
    args: ["--phase=2", "--property=1000", "--case=seed-1000-view"],
  },
  {
    name: "read-flags-load-every-relation",
    file: "graphqlhttp/issue.ergo",
    from: "if options.Relations {",
    to: "if true {",
    pkg: "",
    guard: "parity mismatch",
    args: ["--phase=2", "--case=view-json"],
  },
  {
    name: "bulk-view-keeps-last",
    file: "cli/issue.ergo",
    from: "selectors = selectors.Append(try linear.ParseSelector(id))",
    to: "selectors = []linear.Selector{try linear.ParseSelector(id)}",
    pkg: "",
    guard: "parity mismatch",
    args: ["--phase=2", "--case=view-bulk-three"],
  },
];
for (const mutant of mutants) {
  const dir = await mkdtemp(join(scratch, "mutant-"));
  const module = join(dir, "ergo");
  await cp(join(root, "ergo"), module, { recursive: true });
  const path = join(module, mutant.file);
  const source = await readFile(path, "utf8");
  if (source.split(mutant.from).length !== 2) throw new Error(`${mutant.name}: edit is not unique`);
  await writeFile(path, source.replace(mutant.from, mutant.to));
  let result: { code: number; output: string };
  if (mutant.pkg) {
    result = await run(compiler, ["test", join(module, mutant.pkg), "--seed", "42"], root);
  } else {
    const binary = join(dir, "linear-mutant");
    const built = await run(
      compiler,
      ["build", join(module, "cmd/linear-parity"), "-o", binary],
      root,
    );
    if (built.code !== 0) throw new Error(`${mutant.name}: invalid mutant build: ${built.output}`);
    result = await run(
      process.execPath,
      [
        join(root, "parity/run.ts"),
        ...(mutant.args ?? ["--phase=1", "--seed=42", "--case=seed-42-team"]),
        `--binary=${binary}`,
      ],
      root,
    );
  }
  if (result.code === 0 || !result.output.includes(mutant.guard))
    throw new Error(`${mutant.name}: survived or failed for the wrong reason: ${result.output}`);
  console.log(`killed ${mutant.name}: ${mutant.guard}`);
}
console.log("EXIT: 0 (all phase mutants killed)");

const fakeDir = await mkdtemp(join(scratch, "fake-mutant-"));
await cp(join(root, "parity"), join(fakeDir, "parity"), { recursive: true });
await symlink(join(root, "src"), join(fakeDir, "src"));
await symlink(join(root, "node_modules"), join(fakeDir, "node_modules"));
const fakePath = join(fakeDir, "parity/fake-linear.ts");
const fakeSource = await readFile(fakePath, "utf8");
if (fakeSource.split("w.issues.push(created);").length !== 2)
  throw new Error("fake mutant edit is not unique");
await writeFile(
  fakePath,
  fakeSource.replace("w.issues.push(created);", "/* forget created issue */"),
);
const fakeResult = await run(
  process.execPath,
  [join(fakeDir, "parity/run.ts"), "--record", "--phase=3", "--case=create-json"],
  fakeDir,
);
if (fakeResult.code === 0 || !fakeResult.output.includes("fake-forgets-created-issue survived"))
  throw new Error(`fake mutant survived or failed for the wrong reason: ${fakeResult.output}`);
console.log("killed fake-forgets-created-issue: record-leg identity guard");
console.log("EXIT: 0 (harness mutant killed)");
