// Builds no Go. The public seam is the shim's selected process, argv and status.
import { spawn, spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
// One owned scratch per pilot step; the default is the original pilot folder.
const scratch = process.env.LINEAR_PARITY_SCRATCH ?? "/tmp/opencode/linear-port";
await mkdir(scratch, { recursive: true });
const sourcePath =
  process.argv.find((arg) => arg.startsWith("--shim="))?.slice(7) ?? join(root, "bin/linear");
const source = await readFile(sourcePath, "utf8");

async function run(shim: string, args: string[], home: string, impl?: string) {
  const child = spawn(shim, args, {
    detached: true,
    env: {
      PATH: process.env.PATH ?? "/usr/bin:/bin",
      HOME: home,
      ...(impl === undefined ? {} : { LINEAR_IMPL: impl }),
    },
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
  const timer = setTimeout(stop, 30_000); // stops only a hung switch probe
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) process.on(signal, stop);
  child.stdout.on("data", (data) => {
    out += data;
  });
  child.stderr.on("data", (data) => {
    err += data;
  });
  try {
    const code = await new Promise<number>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", (status, signal) =>
        signal ? reject(new Error(`switch stopped: ${signal}`)) : resolve(status ?? 1),
      );
    });
    return { out, err, code };
  } finally {
    stop();
    active = false;
    clearTimeout(timer);
    for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) process.off(signal, stop);
    const ps = spawnSync("ps", ["-eo", "pid,pgid,stat,comm"], { encoding: "utf8" });
    if (
      ps.status !== 0 ||
      ps.stdout.split("\n").some((line) => {
        const fields = line.trim().split(/\s+/);
        return fields[1] === String(child.pid) && !fields[2]?.startsWith("Z");
      })
    )
      // oxlint-disable-next-line no-unsafe-finally -- A leaked owned process invalidates the probe's result.
      throw new Error("switch left an owned process");
  }
}

async function verify(script: string) {
  const home = await mkdtemp(join(scratch, "switch-"));
  const shim = join(home, "linear");
  await writeFile(shim, script, { mode: 0o755 });
  for (const impl of ["ts", "ergo"]) {
    await writeFile(
      join(home, `linear-${impl}`),
      `#!/bin/sh\nprintf '%s\\n' '${impl}' "$@"\nexit 23\n`,
      { mode: 0o755 },
    );
  }
  async function expect(args: string[], expected: "ts" | "ergo", impl?: string) {
    const got = await run(shim, args, home, impl);
    if (got.out !== `${[expected, ...args].join("\n")}\n` || got.err !== "" || got.code !== 23)
      throw new Error(`route/argv mismatch: ${JSON.stringify({ args, impl, expected, got })}`);
  }
  const native = [
    "auth whoami",
    "team list",
    "project list",
    "issue list",
    "issue view",
    "issue files",
    "issue start",
    "issue comment",
    "file download",
    "api graphql",
  ];
  for (const command of native) {
    const args = command.split(" ");
    await expect(args, "ergo");
    await expect([...args, "--interactive"], "ts");
    await expect([...args, "--log-level=debug"], "ts");
  }
  for (const args of [
    [],
    ["auth"],
    ["issue"],
    ["issue", "create", "--title", "x"],
    ["unknown", "list"],
  ])
    await expect(args, "ts");
  for (const arg of ["--help", "-h", "--version"]) await expect([arg], "ergo");
  // Seeded opaque argv includes empty, whitespace, shell metacharacters, Unicode
  // and a terminator. The shim must forward bytes, not interpret any of them.
  let seed = 42;
  const words = ["", "two words", "--", "-o", "a=b", "λ", "'quoted'", "$opaque", "line\nbreak"];
  for (let i = 0; i < words.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const args = ["issue", "view", words[seed % words.length]!, words[i]!];
    await expect(args, "ts", "ts");
    await expect(args, "ergo", "ergo");
  }
  await expect(["issue", "create", "--interactive"], "ergo", "ergo");
  const invalid = await run(shim, ["team", "list"], home, "other");
  if (
    invalid.code !== 1 ||
    invalid.out !== "" ||
    invalid.err !== "LINEAR_IMPL must be ts or ergo\n"
  )
    throw new Error("invalid override was not refused");
  // Missing native binary is only a default fallback, never an override.
  await chmod(join(home, "linear-ergo"), 0o644);
  await expect(["team", "list"], "ts");
  const missing = await run(shim, ["team", "list"], home, "ergo");
  if (missing.code === 23 || missing.out !== "")
    throw new Error("explicit ergo silently fell back");
}

await verify(source);
console.log("switch routing, argv and status passed (seed 42)");
const native = process.argv.find((arg) => arg.startsWith("--native="))?.slice(9);
if (native) {
  const home = await mkdtemp(join(scratch, "version-"));
  const version = await run(native, ["--version"], home);
  if (version.code !== 0 || version.err !== "" || version.out !== "linear v0.6.0\n")
    throw new Error("root-version-undeclared: version differs");
  console.log("native declared root version passed");
}
if (process.argv.includes("--mutants")) {
  const mutants = [
    ["default-routes-interactive-to-ergo", "--interactive|--interactive=*|", ""],
    ["config-create-routes-to-ergo", "auth:whoami|team:list", "issue:create|auth:whoami|team:list"],
    [
      "override-ignored",
      'ts) exec "$bindir/linear-ts" "$@"',
      'ts) exec "$bindir/linear-ergo" "$@"',
    ],
    ["shim-loses-argument", 'exec "$bindir/linear-$impl" "$@"', 'exec "$bindir/linear-$impl"'],
  ];
  for (const [name, from, to] of mutants) {
    if (!from || to === undefined || source.split(from).length !== 2)
      throw new Error(`${name}: edit is not unique`);
    let killed = false;
    try {
      await verify(source.replace(from, to));
    } catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith("route/argv mismatch:"))
        throw error;
      killed = true;
    }
    if (!killed) throw new Error(`${name}: survived`);
    console.log(`killed ${name}`);
  }
}
console.log("SWITCH EXIT: 0");
