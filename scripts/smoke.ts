// Smoke the npm package the way a user gets it: pack it, install the tarball
// with bun and with npm into a clean HOME, then run the installed `linear`
// (--version, --help and the fixed parity case no-token) on this host. It runs
// after scripts/release.ts has built at least this host's binary. Offline: the
// package has no dependencies, and no-token never reaches Linear.
//
//   bun scripts/smoke.ts [--scratch=DIR]
import { spawn, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const base =
  process.argv.find((arg) => arg.startsWith("--scratch="))?.slice(10) ??
  "/tmp/opencode/linear-smoke";
await mkdir(base, { recursive: true });
const scratch = await mkdtemp(join(base, "smoke-"));
const { version } = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const hostPath = process.env.PATH ?? "/usr/bin:/bin";

async function run(command: string, args: string[], env: Record<string, string>, cwd = scratch) {
  const child = spawn(command, args, {
    cwd,
    detached: true,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let out = "",
    err = "",
    active = true;
  const stop = () => {
    if (active && child.pid) {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {
        /* exited */
      }
    }
  };
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) process.on(signal, stop);
  child.stdout.on("data", (data) => (out += data));
  child.stderr.on("data", (data) => (err += data));
  try {
    const code = await new Promise<number>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", (status, signal) =>
        signal ? reject(new Error(`${command} stopped: ${signal}`)) : resolve(status ?? 1),
      );
    });
    return { out, err, code };
  } finally {
    stop();
    active = false;
    for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) process.off(signal, stop);
  }
}

function must(ok: boolean, what: string, detail: unknown) {
  if (!ok) throw new Error(`smoke: ${what}: ${JSON.stringify(detail)}`);
}

// Pack. --ignore-scripts: `prepare` installs git hooks; prepack's check runs here.
const packEnv = { PATH: hostPath, HOME: join(scratch, "pack-home") };
const checked = await run(
  process.execPath,
  [join(root, "scripts/release.ts"), "--check", `--platform=${hostPlatform()}`],
  packEnv,
  root,
);
must(checked.code === 0, "release check", checked);
const packed = await run(
  "npm",
  [
    "pack",
    "--ignore-scripts",
    "--json",
    "--pack-destination",
    scratch,
    "--cache",
    join(scratch, "npm-cache"),
  ],
  packEnv,
  root,
);
must(packed.code === 0, "npm pack", packed);
const [{ filename, files }] = JSON.parse(packed.out);
const tarball = join(scratch, filename);
const listed: string[] = files.map((f: { path: string }) => f.path);
must(listed.includes("bin/linear"), "the package has bin/linear", listed);
must(
  listed.includes(`npm/${npmDir(hostPlatform())}/linear`),
  "the package has this host's binary",
  listed,
);
must(
  !listed.some(
    (p) => p.startsWith("src/") || p.startsWith("bin/linear-") || p.endsWith(".partial"),
  ),
  "the package ships only the launcher, the native binaries and skills",
  listed,
);
const modes = spawnSync("tar", ["tvzf", tarball], { encoding: "utf8" }).stdout;
const executables = modes
  .split("\n")
  .filter((l) => / package\/(bin\/linear|npm\/.*\/linear)$/.test(l));
must(executables.length >= 2, "the tarball lists the launcher and a binary", modes);
for (const line of executables)
  must(line.startsWith("-rwxr-xr-x"), "executables keep their mode in the tarball", line);

// Install into clean homes.
const installs: [string, string][] = [];
{
  const home = join(scratch, "home-bun");
  const env = {
    PATH: hostPath,
    HOME: home,
    BUN_INSTALL: join(home, ".bun"),
    BUN_INSTALL_CACHE_DIR: join(home, "bun-cache"),
  };
  await mkdir(home);
  const got = await run(process.execPath, ["add", "-g", tarball], env, home);
  must(got.code === 0, "bun add -g", got);
  installs.push(["bun", join(home, ".bun/bin/linear")]);
}
{
  const home = join(scratch, "home-npm");
  const env = { PATH: hostPath, HOME: home, npm_config_cache: join(home, "npm-cache") };
  await mkdir(home);
  const got = await run(
    "npm",
    ["install", "-g", "--prefix", join(home, "prefix"), tarball],
    env,
    home,
  );
  must(got.code === 0, "npm install -g", got);
  installs.push(["npm", join(home, "prefix/bin/linear")]);
}

const parityCase = join(root, "parity/cases/no-token");
const caseArgs = (await readFile(join(parityCase, "args"), "utf8")).split("\n").slice(0, -1);
const expected = {
  out: await readFile(join(parityCase, "expected.out"), "utf8"),
  err: await readFile(join(parityCase, "expected.err"), "utf8"),
  code: Number(await readFile(join(parityCase, "expected.status"), "utf8")),
};
for (const [tool, linear] of installs) {
  const work = await mkdtemp(join(scratch, `run-${tool}-`));
  const env = { PATH: "/usr/bin:/bin", HOME: work }; // no bun, node or token on PATH/env
  const v = await run(linear, ["--version"], env, work);
  must(v.code === 0 && v.err === "" && v.out === `linear v${version}\n`, `${tool}: --version`, v);
  const help = await run(linear, ["--help"], env, work);
  must(help.code === 0 && help.out.includes("Commands:"), `${tool}: --help`, help);
  const got = await run(linear, caseArgs, env, work);
  must(
    got.out === expected.out && got.err === expected.err && got.code === expected.code,
    `${tool}: parity case no-token`,
    { got, expected },
  );
  const leftovers = await readdir(work);
  must(leftovers.length === 0, `${tool}: no-token wrote no files`, leftovers);
  console.log(`${tool}: ${linear} --version, --help, no-token passed`);
}
console.log(`SMOKE EXIT: 0 (${filename})`);

function hostPlatform() {
  const os = process.platform;
  const arch = process.arch === "x64" ? "amd64" : process.arch;
  return `${os}/${arch}`;
}
function npmDir(platform: string) {
  return platform.replace("/amd64", "-x64").replace("/arm64", "-arm64").replace("/", "-");
}
