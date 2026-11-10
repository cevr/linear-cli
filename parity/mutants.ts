// Mutants run only in generated copies under the pilot's own scratch folder.
import { spawn, spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
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

const mutants = [
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
        "--phase=1",
        "--seed=42",
        "--case=seed-42-team",
        `--binary=${binary}`,
      ],
      root,
    );
  }
  if (result.code === 0 || !result.output.includes(mutant.guard))
    throw new Error(`${mutant.name}: survived or failed for the wrong reason: ${result.output}`);
  console.log(`killed ${mutant.name}: ${mutant.guard}`);
}
console.log("EXIT: 0 (all L1 mutants killed)");
