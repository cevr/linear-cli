// Builds no Go. The native binary's --version line follows package.json.
//
//   bun parity/version.ts --native=PATH
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const { version } = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const scratch = process.env.LINEAR_PARITY_SCRATCH ?? "/tmp/opencode/linear-port";
await mkdir(scratch, { recursive: true });
const native = process.argv.find((arg) => arg.startsWith("--native="))?.slice(9);
if (!native) throw new Error("usage: bun parity/version.ts --native=PATH");
const home = await mkdtemp(join(scratch, "version-"));
const got = spawnSync(native, ["--version"], {
  cwd: home,
  env: { PATH: "/usr/bin:/bin", HOME: home },
  encoding: "utf8",
  timeout: 30_000, // stops only a hung binary
});
if (got.status !== 0 || got.stderr !== "" || got.stdout !== `linear v${version}\n`)
  throw new Error("root-version-undeclared: version differs");
console.log("native declared root version passed");
