import type { Case } from "./corpus";

// ECMAScript WhiteSpace + LineTerminator, independent of Go's Unicode table.
// Control validation runs first; vertical tab/form feed therefore still fail.
const whitespace = [
  0x09,
  0x0a,
  0x0b,
  0x0c,
  0x0d,
  0x20,
  0xa0,
  0x1680,
  ...Array.from({ length: 11 }, (_, i) => 0x2000 + i),
  0x2028,
  0x2029,
  0x202f,
  0x205f,
  0x3000,
  0xfeff,
];
const nearWhitespace = [0x85, 0x180e, 0x200b, 0x2060];
const control = (s: string) =>
  Array.from(s).some((c) => {
    const n = c.codePointAt(0)!;
    return n === 0x7f || (n < 0x20 && ![9, 10, 13].includes(n));
  });
export function regressionCases(phase: string, seed: number): Case[] {
  const make = (
    name: string,
    args: string[],
    status = 0,
    files?: Record<string, string>,
  ): Case => ({
    name: `regression-${phase}-${name}`,
    phase: { L0: 0, L3: 3, L4: 4 }[phase] ?? 3,
    args,
    seed,
    expectedStatus: status,
    files,
  });
  if (phase === "L0")
    return [
      make("member", ["issue", "view", "ENG-123", "--json"]),
      make("nonmember", ["issue", "view", `ENG-${900000 + seed}`, "--json"], 1),
    ];
  if (phase === "L3") {
    const scalars = [...whitespace, ...nearWhitespace, 0, 0x7f, 0x41, 0x1f680];
    const texts = scalars.map((n) => String.fromCodePoint(n));
    texts.push(
      whitespace.map((n) => String.fromCodePoint(n)).join(""),
      "\ufeff\u0085\u3000",
      " \u0085 ",
      " \u200b ",
    );
    let state = seed >>> 0;
    // Seeded mixed strings complement the scalar sweep. U+2028/29 have an
    // already-declared JSON encoding difference, so keep them in the blank
    // scalar sweep, not in accepted mixed-string output.
    const mix = scalars.filter((n) => n !== 0 && n !== 0x2028 && n !== 0x2029);
    for (let i = 0; i < 12; i++) {
      let text = "";
      for (let j = 0; j < 1 + (i % 5); j++) {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        text += String.fromCodePoint(mix[state % mix.length]!);
      }
      texts.push(text);
    }
    const textCases = texts.flatMap((text, i) => {
      const blank = Array.from(text).every((c) => whitespace.includes(c.codePointAt(0)!));
      const status = control(text) || blank ? 1 : 0;
      return [
        make(
          `title-${i}`,
          ["issue", "create", "--team", "ENG", "--title", text, "--dry-run"],
          status,
        ),
        make(`comment-${i}`, ["issue", "comment", "ENG-123", "--body", text, "--dry-run"], status),
      ];
    });
    // argv cannot contain NUL; control acceptance is also covered by the
    // existing CreateReadyTitle law at the public validator seam.
    const malformed = [
      "{",
      `[${seed},`,
      `{"x":${seed},}`,
      `{"x":"\\uZZZZ"}`,
      "true false",
      "",
      '{"x":undefined}',
    ];
    const kinds = [
      "[]",
      `[${seed}]`,
      "null",
      "true",
      "false",
      String(seed),
      JSON.stringify(`value-${seed}`),
    ];
    return [
      ...textCases.filter((c) => !c.args.some((arg) => arg.includes("\0"))),
      ...[...malformed, ...kinds].map((json, i) =>
        make(
          `variables-${i}`,
          ["api", "graphql", "--query", "{ viewer { id } }", "--variables", json],
          1,
        ),
      ),
      ...["missing.graphql", `absent-${seed}/query.graphql`, "blocked/query.graphql", "folder"].map(
        (path, i) =>
          make(`file-${i}`, ["api", "graphql", "--query-file", path], 1, {
            blocked: "not a directory",
            "folder/child": "query { viewer { id } }",
          }),
      ),
    ];
  }
  if (phase === "L4")
    return [
      "https://uploads.linear.app:443/trace.txt",
      "HTTPS://UPLOADS.LINEAR.APP:443/trace.txt",
      "https://uploads.linear.app:0443/trace.txt",
      "https://uploads.linear.app/a/../trace.txt",
      "https://uploads.linear.app/a/%2e%2E/trace.txt",
      "https://uploads.linear.app/a/./trace.txt",
      "https://uploads.linear.app/trac%65.txt",
      `https://uploads.linear.app/trace-${seed}.txt?x=%2F#part`,
      "https://uploads.linear.app/space name.txt",
      "https://uploads.linear.app/café.txt",
      " https://uploads.linear.app/trace.txt\n",
      "https:\\uploads.linear.app\\trace.txt",
      "https://uploads.linear.app",
    ].map((url, i) => make(`upload-${i}`, ["file", "download", url, "--json"]));
  throw new Error(`Unknown regression phase ${phase}`);
}
