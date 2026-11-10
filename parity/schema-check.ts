// Public build input only. Never calls Linear's API or reads credentials.
// Generated schema and receipts are outputs of this probe, not hand-written source.
import { buildSchema, parse, validate } from "graphql";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const root = join(import.meta.dir, "..");
const pin = JSON.parse(await readFile(join(import.meta.dir, "schema-pin.json"), "utf8"));
const pkg = JSON.parse(await readFile(join(root, "node_modules/@linear/sdk/package.json"), "utf8"));
if (pkg.version !== pin.sdk) throw new Error(`SDK drift: expected ${pin.sdk}, got ${pkg.version}`);
const schemaPath = join(import.meta.dir, "schema.graphql");
let text: string;
if (process.argv.includes("--fetch")) {
  const url = `https://raw.githubusercontent.com/linear/linear/${pin.commit}/${pin.path}`;
  const response = await fetch(url, { redirect: "error" });
  if (!response.ok) throw new Error(`public schema fetch: HTTP ${response.status}`);
  text = await response.text();
  await mkdir(dirname(schemaPath), { recursive: true });
  await writeFile(schemaPath, text);
} else {
  text = await readFile(schemaPath, "utf8");
}
const schema = buildSchema(text);
const source = await readFile(join(root, "node_modules/@linear/sdk/dist/index.mjs"), "utf8");
const documents = [
  ...source.matchAll(/const (\w+Document) = new TypedDocumentString\(`([\s\S]*?)`\);/g),
];
if (documents.length === 0) throw new Error("No SDK documents found; extractor needs review");
const failures: { document: string; errors: string[] }[] = [];
for (const [, name, query] of documents) {
  const errors = validate(schema, parse(query!));
  if (errors.length) failures.push({ document: name!, errors: errors.map((e) => e.message) });
}
// Negative control: this must fail even if the release documents all pass.
const mutantErrors = validate(schema, parse("query { teams { nodes { nonexistentPilotField } } }"));
if (mutantErrors.length === 0) throw new Error("schema-accepts-unknown-field survived");
const report = {
  schema: pin,
  sha256: createHash("sha256").update(text).digest("hex"),
  checkedDocuments: documents.length,
  failures,
  negativeControl: "schema-accepts-unknown-field killed",
};
if (process.argv.includes("--fetch")) {
  await writeFile(
    join(import.meta.dir, "schema-result.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
}
console.log(
  `SDK ${pin.sdk}: ${documents.length} documents, ${failures.length} invalid; negative control killed`,
);
if (failures.length) {
  console.error(JSON.stringify(failures.slice(0, 3), null, 2));
  process.exitCode = 1;
}
