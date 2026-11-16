// Builds Go because process-visible CLI bytes, exits, filesystem changes and
// transport behavior cannot be established by an in-process checker.
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  readlink,
  realpath,
  symlink,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { cases, generatedCases } from "./corpus";
import type { Case } from "./corpus";
import { fakeLinear } from "./fake-linear";
import { world } from "./world";
import { regressionCases } from "./regressions";
import { checkRootLookups } from "./lookup-property";
import { q99Equal } from "./owner-exceptions";
import { refusal } from "./upload-property";
import { frozen } from "./frozen";

const root = resolve(import.meta.dir, "..");
// One owned scratch per pilot step; the default is the original pilot folder.
const scratch = process.env.LINEAR_PARITY_SCRATCH ?? "/tmp/opencode/linear-port";
const candidate = process.argv.find((x) => x.startsWith("--binary="))?.slice("--binary=".length);
if (candidate && !(await realpath(candidate)).startsWith(`${scratch}/`))
  throw new Error("Candidate binary must be under the pilot scratch directory");
// --launcher runs every case through a copy of the real bin/linear, with the
// offline entry as its checkout sibling.
const launcher = process.argv.includes("--launcher");
if (launcher && candidate) throw new Error("--launcher cannot be combined with --binary");
const phaseArg = process.argv.find((x) => x.startsWith("--phase="));
const phase = phaseArg ? Number(phaseArg.split("=")[1]) : 6;
const caseArg = process.argv.find((x) => x.startsWith("--case="))?.split("=")[1];
const seeds = process.argv.find((x) => x.startsWith("--seed="))?.split("=")[1];
const property = process.argv.find((x) => x.startsWith("--property="))?.split("=")[1];
let all = seeds ? generatedCases(Number(seeds)) : cases;
const regressions = process.argv.find((arg) => arg.startsWith("--regressions="))?.slice(14);
if (regressions === "L0") await checkRootLookups(Number(seeds ?? 42));
if (regressions) all = regressionCases(regressions, Number(seeds ?? 42));
if (property)
  all = Array.from({ length: 12 }, (_, i) => generatedCases(Number(property) + i)).flat();
const selected = all.filter((c) => c.phase <= phase && (!caseArg || c.name === caseArg));
if (!selected.length) throw new Error("No parity cases selected");
await mkdir(scratch, { recursive: true });
// The property and regression cases compare with the TypeScript CLI's recorded
// outputs (parity/frozen); the fixed cases with parity/cases.
const records =
  property || regressions
    ? frozen(
        property ? "property" : `regressions-${regressions}`,
        property ?? seeds ?? 42,
        Boolean(caseArg),
      )
    : undefined;

const quote = (s: string) => `'${s.replaceAll("'", "'\\''")}'`;
// Exercise the real launcher, but bind only the offline entry. The shipped
// native entry must never accept the fake-origin environment variables.
let shim: string | undefined;
if (launcher) {
  const siblings = await mkdtemp(join(scratch, "launcher-"));
  shim = join(siblings, "linear");
  await writeFile(shim, await readFile(join(root, "bin/linear")), { mode: 0o755 });
  await symlink(join(root, "bin/linear-ergo-parity"), join(siblings, "linear-ergo"));
}
function setup(c: Case): string {
  const lines = ["set -eu", "umask 022"];
  for (const [path, text] of Object.entries(c.files ?? {})) {
    lines.push(`mkdir -p ${quote(dirname(path))}`, `printf %s ${quote(text)} > ${quote(path)}`);
  }
  for (const [path, to] of Object.entries(c.links ?? {}))
    lines.push(`mkdir -p ${quote(dirname(path))}`, `ln -s ${quote(to)} ${quote(path)}`);
  for (const [path, mode] of Object.entries(c.modes ?? {}))
    lines.push(`chmod ${mode.toString(8).padStart(3, "0")} ${quote(path)}`);
  if (c.tokenFile)
    lines.push(
      "mkdir -p .config/linear",
      "umask 077",
      "printf 'pilot-test-token\\n' > .config/linear/token",
      "umask 022",
    );
  if (c.symlink)
    lines.push(
      "printf 'query { viewer { id } }\\n' > ../outside-query.graphql",
      "ln -s ../outside-query.graphql escape.graphql",
    );
  return `${lines.join("\n")}\n`;
}
function caseEnv(c: Case): string {
  const lines = ["HOME=."];
  if (!c.noToken)
    lines.push(`LINEAR_API_KEY=${c.badEnvToken ? "wrong-fixture-token" : "pilot-test-token"}`);
  return `${lines.join("\n")}\n`;
}

type Result = { out: string; err: string; status: number; files: unknown[]; mutations: unknown[] };
function confirmNoOwnedProcesses(pid: number | undefined, name: string) {
  // Inspect only process identity fields, never another session's arguments.
  const ps = spawnSync("ps", ["-eo", "pid,ppid,pgid,stat,comm"], { encoding: "utf8" });
  if (ps.status !== 0) throw new Error("Could not check owned process cleanup");
  const leftovers = ps.stdout.split("\n").filter((line) => {
    const fields = line.trim().split(/\s+/);
    return fields[2] === String(pid) && !fields[3]?.startsWith("Z");
  });
  if (leftovers.length)
    throw new Error(`${name}: owned process group remains: ${leftovers.join("; ")}`);
}
async function snapshot(folder: string, prefix = ""): Promise<unknown[]> {
  const entries: unknown[] = [];
  for (const name of (await readdir(join(folder, prefix))).sort()) {
    const path = join(prefix, name);
    if (path === "escape.graphql") continue;
    const info = await lstat(join(folder, path));
    if (info.isSymbolicLink()) entries.push({ path, link: await readlink(join(folder, path)) });
    else if (info.isDirectory()) entries.push(...(await snapshot(folder, path)));
    else
      entries.push({
        path,
        mode: (info.mode & 0o777).toString(8),
        sha256: createHash("sha256")
          .update(await readFile(join(folder, path)))
          .digest("hex"),
      });
  }
  return entries;
}

function processArgs(command: string, args: string[], c: Case) {
  if (!c.argvBytes) return { command, args };
  const rawArgs = args.map(
    (arg, i) => c.argvBytes![i - (args.length - c.args.length)] ?? Buffer.from(arg).toString("hex"),
  );
  return { command: "python3", args: [join(root, "parity/argv.py"), command, ...rawArgs] };
}

async function run(c: Case): Promise<Result> {
  const w = world(c.seed ?? 1);
  if (c.scenario === "empty") {
    w.teams.length = 0;
    w.projects.length = 0;
    w.issues.length = 0;
  }
  if (c.scenario === "one-team") w.teams.length = 1;
  if (c.scenario === "unsafe-names")
    w.issues[0]!.description =
      "[../../escape.txt](https://uploads.linear.app/a) ![.env](https://uploads.linear.app/b)";
  if (c.scenario === "duplicate-names")
    w.issues[0]!.description =
      "[trace.txt](https://uploads.linear.app/a) [trace.txt](https://uploads.linear.app/b) [trace.txt](https://uploads.linear.app/a)";
  const fake = fakeLinear(w, c.failure, 0, c.apiError);
  const dir = await mkdtemp(`${scratch}/case-${c.name}-`);
  for (const [name, text] of Object.entries(c.files ?? {})) {
    const file = join(dir, name);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, text, { mode: 0o644 });
  }
  if (c.tokenFile) {
    await mkdir(join(dir, ".config/linear"), { recursive: true });
    await writeFile(join(dir, ".config/linear/token"), "pilot-test-token\n", { mode: 0o600 });
  }
  if (c.symlink) {
    const outside = join(scratch, "outside-query.graphql");
    await writeFile(outside, "query { viewer { id } }\n");
    await symlink(outside, join(dir, "escape.graphql"));
  }
  for (const [name, to] of Object.entries(c.links ?? {})) {
    await mkdir(dirname(join(dir, name)), { recursive: true });
    await symlink(to, join(dir, name));
  }
  // Restore readable modes before the snapshot and on every exit path.
  const unlock = async () => {
    for (const name of Object.keys(c.modes ?? {}))
      await chmod(join(dir, name), (await lstat(join(dir, name))).isDirectory() ? 0o755 : 0o644);
  };
  for (const [name, mode] of Object.entries(c.modes ?? {})) await chmod(join(dir, name), mode);
  const env: Record<string, string> = {
    BUN_RUNTIME_TRANSPILER_CACHE_PATH: join(scratch, "transpiler-cache"),
    BUN_INSTALL_CACHE_DIR: join(scratch, "install-cache"),
    PATH: process.env.PATH ?? "/usr/bin:/bin",
    HOME: dir,
    LINEAR_PARITY_HOME: dir,
    LINEAR_PARITY_ORIGIN: fake.origin,
    LINEAR_PARITY_STORAGE_ORIGIN: fake.storageOrigin,
    NO_COLOR: "1",
    TZ: "UTC",
  };
  if (!c.noToken) env.LINEAR_API_KEY = c.badEnvToken ? "wrong-fixture-token" : "pilot-test-token";
  if (env.HOME !== dir) throw new Error("runner-uses-owner-home survived");
  const command = shim ?? candidate ?? join(root, "bin/linear-ergo-parity");
  let out = "",
    err = "";
  const launch = processArgs(command, c.args, c);
  const child = spawn(launch.command, launch.args, {
    cwd: dir,
    env,
    detached: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  let active = true;
  const stop = () => {
    if (active && child.pid) {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch (e: any) {
        if (e.code !== "ESRCH") throw e;
      }
    }
  };
  // Deadline only stops a hung case; no assertion depends on elapsed time.
  const timer = setTimeout(stop, 30_000);
  const stopSignal = () => stop();
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) process.on(signal, stopSignal);
  let overflow = false;
  child.stdout.on("data", (b) => {
    out += b;
    if (Buffer.byteLength(out) > 1_048_576) {
      overflow = true;
      stop();
    }
  });
  child.stderr.on("data", (b) => {
    err += b;
    if (Buffer.byteLength(err) > 1_048_576) {
      overflow = true;
      stop();
    }
  });
  child.stdin.end();
  try {
    const status = await new Promise<number>((ok, fail) => {
      child.once("error", fail);
      child.once("close", (code, signal) =>
        signal ? fail(new Error(`${c.name}: child ended by ${signal}`)) : ok(code ?? 1),
      );
    });
    if (overflow) throw new Error(`${c.name}: child output exceeded cap`);
    if (fake.storageHeaders.some(Boolean)) throw new Error(`${c.name}: credential reached storage`);
    if (c.args.includes("--dry-run") && fake.mutations.length)
      throw new Error(`${c.name}: dry-run-sends-mutation survived`);
    if (
      status === 0 &&
      c.args[0] === "issue" &&
      c.args[1] === "create" &&
      !c.args.includes("--dry-run")
    ) {
      const created = w.issues.find((issue) => issue.identifier === "ENG-999");
      if (!created || !out.includes(created.identifier))
        throw new Error(`${c.name}: fake-forgets-created-issue survived`);
    }
    if (
      status === 0 &&
      c.args[0] === "issue" &&
      c.args[1] === "comment" &&
      !c.args.includes("--dry-run") &&
      !w.comments.some((comment) => comment.id === "00000000-0000-4000-8000-000000000199")
    )
      throw new Error(`${c.name}: fake-forgets-created-comment survived`);
    const normalize = (s: string) => s.replaceAll(dir, "$CASE");
    await unlock();
    return {
      out: normalize(out),
      err: normalize(err),
      status,
      files: await snapshot(dir),
      mutations: fake.mutations,
    };
  } finally {
    stop();
    active = false;
    clearTimeout(timer);
    for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) process.off(signal, stopSignal);
    await unlock();
    await fake.close();
    confirmNoOwnedProcesses(child.pid, c.name);
  }
}

for (const c of selected) {
  const actual = await run(c);
  // A broken fake must not silently become an all-failure golden corpus.
  const failures = new Set([
    "download-notfound",
    "no-token",
    "unauthorized",
    "api-500",
    "api-errors",
    "limit-low",
    "limit-high",
    "repeated-flag",
    "view-missing",
    "view-bad-selector",
    "start-missing",
    "create-missing-title",
    "create-multiple-teams",
    "create-unknown-team",
    "create-unknown-project",
    "create-bad-priority",
    "graphql-mutation-denied",
    "graphql-invalid",
    "graphql-file-escape",
    "download-foreign-host",
    "download-exists",
    "config-malformed",
    "config-invalid-type",
    "view-interactive-no-terminal",
    "create-interactive-no-terminal",
  ]);
  // view and create --interactive with no terminal: the original quit as an
  // interrupt (130); the port refuses with status 1 (declared).
  const wantedStatus = c.expectedStatus ?? (failures.has(c.name) ? 1 : 0);
  if (!regressions && actual.status !== wantedStatus)
    throw new Error(
      `${c.name}: expected exit ${wantedStatus}, got ${actual.status}: ${actual.err}`,
    );
  const path = join(import.meta.dir, "cases", c.name);
  if (regressions && c.declared === "q101") {
    // q101: the port refuses non-empty user information and non-443 ports
    // that the original's parser accepts. Exactly the refusal, nothing else.
    const refused = { out: "", err: refusal(c.args[2]!), status: 1, files: [], mutations: [] };
    if (JSON.stringify(actual) !== JSON.stringify(refused)) {
      console.error(JSON.stringify({ args: c.args, refused, actual }, null, 2));
      throw new Error(`${c.name}: q101 refusal mismatch`);
    }
  } else if (property || regressions) {
    const reference = records!.get<Result>(c.name);
    if (process.argv.includes("--trace"))
      console.log(JSON.stringify({ name: c.name, args: c.args, reference, actual }));
    if (reference.status !== wantedStatus)
      throw new Error(
        `${c.name}: TS control expected ${wantedStatus}, got ${reference.status}: ${reference.err}`,
      );
    if (JSON.stringify(reference) !== JSON.stringify(actual)) {
      console.error(
        JSON.stringify(
          {
            world: world(c.seed),
            args: c.args,
            argvBytes: c.argvBytes,
            apiError: c.apiError,
            reference,
            actual,
            replay: `bun parity/run.ts ${regressions ? `--regressions=${regressions} --seed=${c.seed}` : `--property=${c.seed}`} --phase=${phase} --case=${c.name}${launcher ? " --launcher" : ""}`,
          },
          null,
          2,
        ),
      );
      throw new Error(`${c.name}: parity mismatch`);
    }
  } else {
    // The portable example-format export must stay in sync with its corpus source.
    if (
      (await readFile(join(path, "args"), "utf8")) !== `${c.args.join("\n")}\n` ||
      (await readFile(join(path, "env"), "utf8")) !== caseEnv(c) ||
      (await readFile(join(path, "setup.sh"), "utf8")) !== setup(c) ||
      (await readFile(join(path, "stdin"), "utf8")) !== ""
    ) {
      throw new Error(
        `${c.name}: portable case inputs drifted; the corpus no longer matches the recorded case`,
      );
    }
    const expected = {
      out: await readFile(join(path, "expected.out"), "utf8"),
      err: await readFile(join(path, "expected.err"), "utf8"),
      status: Number(await readFile(join(path, "expected.status"), "utf8")),
      files: JSON.parse(await readFile(join(path, "expected.files"), "utf8")),
      mutations: JSON.parse(await readFile(join(path, "expected.mutations"), "utf8")),
    };
    // Only the one declared usage-layout case compares its semantic diagnostic
    // instead of Effect CLI's help bytes. Domain failure lines stay byte exact.
    if (c.name === "repeated-flag") {
      const reason = 'Invalid value for flag --limit: "2 occurrences". Expected: at most 1 value';
      if (
        actual.status !== 1 ||
        !actual.err.includes(reason) ||
        !actual.out.includes("linear issue list")
      )
        throw new Error("repeated-flag: usage error lost its command, reason or exit status");
      expected.out = actual.out;
      expected.err = actual.err;
    }
    if (c.name === "graphql-invalid") {
      const prefix = "Invalid input: Invalid GraphQL document: ";
      if (!actual.err.startsWith(prefix) || actual.err.length <= prefix.length + 1)
        throw new Error("graphql-invalid: parser diagnostic prefix or detail is absent");
      expected.err = actual.err;
    }
    // q99 does not rewrite a TS result to look equal. It checks the narrowly
    // approved native contract and preserves file/mutation/status assertions.
    const exception = q99Equal(c.name, expected, actual);
    if (!(exception ?? JSON.stringify(expected) === JSON.stringify(actual))) {
      console.error(
        JSON.stringify(
          {
            name: c.name,
            world: world(c.seed ?? 1),
            args: c.args,
            expected,
            actual,
            replay: `bun parity/run.ts --case=${c.name} --phase=${c.phase}`,
          },
          null,
          2,
        ),
      );
      throw new Error(`${c.name}: parity mismatch`);
    }
  }
  console.log(`ok ${c.name}`);
}
records?.done();
console.log(`EXIT: 0 (${selected.length} cases)`);
