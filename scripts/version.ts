// `bun run version` runs `changeset version`, then this: the native CLI's
// `--version` line is a literal in ergo/cli/arguments.ergo, so it follows
// package.json. scripts/release.ts refuses a binary whose line differs.
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const { version } = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const path = join(root, "ergo/cli/arguments.ergo");
const source = await readFile(path, "utf8");
const pattern = /Version: Some\[string\]\{Value: "linear v[^"]*"\}/g;
const found = source.match(pattern) ?? [];
if (found.length !== 1)
  throw new Error(`${path}: expected one root Version, found ${found.length}`);
await writeFile(
  path,
  source.replace(pattern, `Version: Some[string]{Value: "linear v${version}"}`),
);
console.log(`linear v${version}`);
