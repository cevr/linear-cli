// Public build input only. Never calls Linear's API or reads credentials.
// The fake Linear executes GraphQL against parity/schema.graphql, the public
// schema of the SDK release in schema-pin.json. This check holds those bytes
// to the digest in schema-result.json, and proves the schema refuses a field
// it does not have. `--fetch` downloads the pinned file again and records it.
import { buildSchema, parse, validate } from "graphql";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const pin = JSON.parse(await readFile(join(import.meta.dir, "schema-pin.json"), "utf8"));
const schemaPath = join(import.meta.dir, "schema.graphql");
const resultPath = join(import.meta.dir, "schema-result.json");
let text: string;
if (process.argv.includes("--fetch")) {
  const url = `https://raw.githubusercontent.com/linear/linear/${pin.commit}/${pin.path}`;
  const response = await fetch(url, { redirect: "error" });
  if (!response.ok) throw new Error(`public schema fetch: HTTP ${response.status}`);
  text = await response.text();
  await writeFile(schemaPath, text);
} else {
  text = await readFile(schemaPath, "utf8");
}
const sha256 = createHash("sha256").update(text).digest("hex");
const schema = buildSchema(text);
// Negative control: the schema must refuse an unknown field.
const mutantErrors = validate(schema, parse("query { teams { nodes { nonexistentPilotField } } }"));
if (mutantErrors.length === 0) throw new Error("schema-accepts-unknown-field survived");
if (process.argv.includes("--fetch")) {
  const report = { schema: pin, sha256, negativeControl: "schema-accepts-unknown-field killed" };
  await writeFile(resultPath, `${JSON.stringify(report, null, 2)}\n`);
} else {
  const recorded = JSON.parse(await readFile(resultPath, "utf8")).sha256;
  if (recorded !== sha256)
    throw new Error(`schema.graphql drifted: ${sha256}, recorded ${recorded}`);
}
console.log(
  `schema ${pin.sdk} at ${pin.commit.slice(0, 12)}: digest held; negative control killed`,
);
