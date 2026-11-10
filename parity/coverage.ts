// Read command text only; never execute skill content.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cases } from "./corpus";
const files = [
  join(import.meta.dir, "../skills/linear/SKILL.md"),
  "/home/exedev/Developer/personal/dotfiles/skills/linear/SKILL.md",
];
const leaves = new Set([
  "auth",
  "auth whoami",
  "team list",
  "project list",
  "issue list",
  "issue view",
  "issue start",
  "issue create",
  "issue comment",
  "issue files",
  "file download",
  "api graphql",
]);
const deferred = new Set(["auth"]); // Hidden-input terminal acceptance is L5.
const missing = new Set<string>();
for (const file of files) {
  const text = (await readFile(file, "utf8")).replace(/\\\r?\n/g, " ");
  for (const match of text.matchAll(/^\s*linear\s+([^\n]+)/gm)) {
    const invocation = match[1]!.trim();
    const words = invocation.split(/\s+/);
    let leaf = words.slice(0, 2).join(" ");
    if (!leaves.has(leaf) && words[0] === "auth") leaf = "auth";
    if (deferred.has(leaf) || invocation.includes("--interactive")) continue;
    const flags = [...invocation.matchAll(/--[a-z][a-z-]*/g)].map((m) => m[0]);
    const covered =
      leaves.has(leaf) &&
      cases.some(
        (c) =>
          c.args.slice(0, 2).join(" ") === leaf && flags.every((flag) => c.args.includes(flag)),
      );
    if (!covered) missing.add(`${leaf} ${flags.join(" ")}`.trim());
  }
}
if (missing.size)
  throw new Error(`Skill commands without a case: ${[...missing].sort().join(", ")}`);
console.log(
  "Skill command and flag coverage: all non-terminal invocations have cases; auth and --interactive deferred to L5",
);
