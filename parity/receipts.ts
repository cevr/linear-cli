// Counts now; timings/RSS only with --quiet on an admitted quiet host.
// Uses synthetic HOME and fixture tokens. Never invokes the installed CLI.
import { spawn, spawnSync } from "node:child_process";
import { loadavg } from "node:os";
import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fakeLinear } from "./fake-linear";
import { world } from "./world";

const root = resolve(import.meta.dir, "..");
const scratch = process.env.LINEAR_PARITY_SCRATCH;
if (!scratch || !scratch.startsWith("/tmp/opencode/"))
  throw new Error("Set an owned LINEAR_PARITY_SCRATCH under /tmp/opencode");
const quiet = process.argv.includes("--quiet");
const pairFile = process.argv.find((arg) => arg.startsWith("--pairs="))?.slice(8);
if (pairFile && !quiet) throw new Error("Build/test pairs require --quiet");
const folder = await mkdtemp(join(scratch, "receipts-"));
const home = join(folder, "home");
await mkdir(home);
const env: Record<string, string> = {
  PATH: process.env.PATH ?? "/usr/bin:/bin",
  HOME: home,
  LINEAR_API_KEY: "pilot-test-token",
  LINEAR_PARITY_HOME: home,
  NO_COLOR: "1",
  TZ: "UTC",
};
// Forward only resource/cache controls, never ambient credentials or selection.
for (const key of [
  "GOMAXPROCS",
  "GOMEMLIMIT",
  "GOCACHE",
  "GOPATH",
  "GOMODCACHE",
  "GOFLAGS",
  "XDG_CACHE_HOME",
  "BUN_RUNTIME_TRANSPILER_CACHE_PATH",
  "BUN_INSTALL_CACHE_DIR",
  "ERGO_PROGRAM_MEMORY",
])
  if (process.env[key]) env[key] = process.env[key]!;
const raw: unknown[] = [];
const report: unknown[] = [];
const host = { platform: process.platform, arch: process.arch, loadStart: loadavg(), quiet };

async function run(command: string[], extra: Record<string, string> = {}, cwd = home) {
  const child = spawn(command[0]!, command.slice(1), {
    cwd,
    env: { ...env, ...extra },
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let active = true;
  const stop = () => {
    if (active && child.pid) {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch (error) {
        if (!(error instanceof Error) || !("code" in error) || error.code !== "ESRCH") throw error;
      }
    }
  };
  const timer = setTimeout(stop, 600_000); // only stops a hung receipt command
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) process.on(signal, stop);
  let out = "",
    err = "";
  child.stdout.on("data", (data) => (out += data));
  child.stderr.on("data", (data) => (err += data));
  try {
    const code = await new Promise<number>((ok, fail) => {
      child.once("error", fail);
      child.once("close", (status, signal) =>
        signal ? fail(new Error(`receipt stopped: ${signal}`)) : ok(status ?? 1),
      );
    });
    if (code !== 0)
      throw new Error(`receipt command failed (${code}): ${command.join(" ")}\n${err}`);
    return { out, err };
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
      // oxlint-disable-next-line no-unsafe-finally -- A leak invalidates the receipt.
      throw new Error("receipt left an owned process");
  }
}

async function timed(command: string[], extra: Record<string, string>, cwd?: string) {
  const usage = join(folder, "usage");
  const start = performance.now();
  const result = await run(["/usr/bin/time", "-f", "%M", "-o", usage, ...command], extra, cwd);
  return {
    ...result,
    milliseconds: performance.now() - start,
    rssKiB: Number(await readFile(usage, "utf8")),
  };
}

// Exact generic interleaved jobs for deferred build/check/test receipts. Setup
// is outside the timed interval; each command may have its own cwd and env.
if (pairFile) {
  type Command = { argv: string[]; cwd: string; env?: Record<string, string>; before?: string[] };
  const jobs = JSON.parse(await readFile(pairFile, "utf8")) as {
    name: string;
    pairs: number;
    ergo: Command;
    ts: Command;
  }[];
  for (const job of jobs) {
    const totals = { ergo: { ms: 0, rss: 0 }, ts: { ms: 0, rss: 0 } };
    for (let pair = 0; pair < job.pairs; pair++) {
      for (const impl of pair % 2 ? (["ts", "ergo"] as const) : (["ergo", "ts"] as const)) {
        const c = job[impl];
        if (c.before) await run(c.before, c.env, c.cwd);
        const result = await timed(c.argv, c.env ?? {}, c.cwd);
        totals[impl].ms += result.milliseconds;
        totals[impl].rss += result.rssKiB;
        raw.push({ name: job.name, pair, impl, ...result });
      }
    }
    report.push({
      name: job.name,
      timeRatio: totals.ergo.ms / totals.ts.ms,
      rssRatio: totals.ergo.rss / totals.ts.rss,
    });
  }
} else {
  const tsBytes = (await stat(join(root, "bin/linear-ts"))).size;
  for (const name of ["linear-ergo", "linear-ergo-stripped"]) {
    const bytes = (await stat(join(root, "bin", name))).size;
    raw.push({ name, bytes, tsBytes });
    report.push({ name, binaryBytesRatio: bytes / tsBytes });
  }
  if (!quiet) {
    const syscalls: Record<string, number> = {};
    for (const impl of ["ergo", "ts"]) {
      const path = join(folder, `syscalls-${impl}.txt`);
      await run([
        "strace",
        "-f",
        "-c",
        "-S",
        "calls",
        "-U",
        "calls,name",
        "-o",
        path,
        join(root, "bin", `linear-${impl}`),
        "--version",
      ]);
      const summary = await readFile(path, "utf8");
      const total = /^\s*(\d+)\s+total\s*$/m.exec(summary)?.[1];
      if (!total) throw new Error("No count-only syscall total");
      syscalls[impl] = Number(total);
      raw.push({ impl, startupSyscalls: Number(total), summary });
    }
    report.push({ name: "version-startup-syscalls", syscallRatio: syscalls.ergo! / syscalls.ts! });
  }
  const startup = [
    { name: "version", args: ["--version"] },
    { name: "help", args: ["--help"] },
    { name: "comment-dry", args: ["issue", "comment", "ENG-123", "--body", "Ready", "--dry-run"] },
  ];
  const reads = [
    { name: "teams", args: ["team", "list", "--json"] },
    {
      name: "view-one",
      args: ["issue", "view", "ENG-123", "--children", "--comments", "--relations", "--json"],
    },
    {
      name: "view-five",
      args: [
        "issue",
        "view",
        "ENG-123",
        "ENG-124",
        "ENG-125",
        "ENG-126",
        "ENG-127",
        "--children",
        "--comments",
        "--relations",
        "--json",
      ],
    },
    { name: "list-50", args: ["issue", "list", "--limit", "50", "--json"] },
  ];
  for (const requestDelayMs of quiet ? [0, 20] : [0]) {
    for (const c of [...(requestDelayMs === 0 ? startup : []), ...reads]) {
      const network = reads.includes(c);
      const totals = { ergo: { ms: 0, rss: 0, requests: 0 }, ts: { ms: 0, rss: 0, requests: 0 } };
      let pairs = 1;
      if (quiet) pairs = network ? 30 : 50;
      for (let pair = 0; pair < pairs; pair++) {
        const outputs: Partial<Record<"ergo" | "ts", string>> = {};
        for (const impl of pair % 2 ? (["ts", "ergo"] as const) : (["ergo", "ts"] as const)) {
          const w = world(2);
          // Exactly five existing issue identities; page size 2 retains paging.
          w.issues = Array.from({ length: 5 }, (_, i) => ({
            ...w.issues[i % w.issues.length]!,
            id: `00000000-0000-4000-8000-${String(10 + i).padStart(12, "0")}`,
            identifier: `ENG-${123 + i}`,
            url: `https://linear.app/issue/ENG-${123 + i}`,
          }));
          const fake = fakeLinear(w, "none", requestDelayMs);
          try {
            const extra = {
              LINEAR_PARITY_ORIGIN: fake.origin,
              LINEAR_PARITY_STORAGE_ORIGIN: fake.storageOrigin,
            };
            const binary = join(root, "bin", `linear-${impl}${network ? "-parity" : ""}`);
            const command = [binary, ...c.args];
            const result: { out: string; err: string; milliseconds?: number; rssKiB?: number } =
              quiet ? await timed(command, extra) : await run(command, extra);
            outputs[impl] = JSON.stringify({ out: result.out, err: result.err });
            if (
              fake.mutations.length ||
              fake.storageHeaders.some(Boolean) ||
              fake.requests.some((r) => !r.authenticated)
            )
              throw new Error("receipt made a mutation or failed the credential guard");
            totals[impl].requests += fake.requests.length;
            if (result.milliseconds !== undefined) {
              totals[impl].ms += result.milliseconds;
              totals[impl].rss += result.rssKiB!;
            }
            raw.push({
              name: c.name,
              requestDelayMs,
              pair,
              impl,
              requests: fake.requests,
              ...result,
            });
          } finally {
            await fake.close();
          }
        }
        // Help layout is the declared exception; count only equal work for the
        // other workloads, including the new five-issue receipt fixture.
        if (c.name !== "help" && outputs.ergo !== outputs.ts)
          throw new Error(`receipt outputs differ: ${c.name}, pair ${pair}`);
      }
      report.push({
        name: c.name,
        requestDelayMs,
        requestRatio: totals.ts.requests ? totals.ergo.requests / totals.ts.requests : null,
        ...(quiet
          ? { timeRatio: totals.ergo.ms / totals.ts.ms, rssRatio: totals.ergo.rss / totals.ts.rss }
          : {}),
      });
    }
  }
}
const receipt = { host: { ...host, loadEnd: loadavg() }, report, raw };
await writeFile(join(folder, "raw.json"), `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify({ ...receipt, raw: join(folder, "raw.json") }, null, 2));
console.log("RECEIPTS EXIT: 0");
