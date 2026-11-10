// Build outputs only. No install/link operation is part of this local pilot.
import { spawn } from "node:child_process";
import { chmod, mkdir } from "node:fs/promises";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
await mkdir(join(root, "bin"), { recursive: true });
async function run(command: string, args: string[]) {
  const child = spawn(command, args, { cwd: root, stdio: "inherit", detached: true });
  let active = true;
  const stop = () => {
    if (active && child.pid) {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        /* already reaped */
      }
    }
  };
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) process.on(signal, stop);
  try {
    const code = await new Promise<number>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", (status) => resolve(status ?? 1));
    });
    if (code !== 0) throw new Error(`${command} exited ${code}`);
  } finally {
    stop();
    active = false;
    for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) process.off(signal, stop);
  }
}
await chmod(join(root, "bin/linear"), 0o755);
if (process.argv.includes("--ergo")) {
  await run(process.env.ERGO ?? "ergo", ["build", "ergo/cmd/linear", "-o", "bin/linear-ergo"]);
} else {
  await run(process.execPath, [
    "build",
    "./src/main.ts",
    "--compile",
    "--outfile",
    "bin/linear-ts",
  ]);
}
