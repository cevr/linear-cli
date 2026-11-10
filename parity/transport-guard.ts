// Runs under redirect.ts with an isolated HOME. Any actual network send is a bug.
export {};
for (const [url, init, message] of [
  ["https://refused.linear-pilot.invalid/graphql", {}, "Offline parity refused origin"],
  [
    "https://storage.linear-pilot.invalid/object",
    { headers: { Authorization: "pilot-test-token" } },
    "Credential leaked to fixture storage",
  ],
] as const) {
  let rejected = false;
  try {
    await fetch(url, init);
  } catch (e) {
    rejected = String(e).includes(message);
  }
  if (!rejected) throw new Error(`Transport guard survived: ${message}`);
}
console.log("Offline origin refusal and credential guard: killed");
