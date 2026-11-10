import type { Case } from "./corpus";
import { uploadCases } from "./upload-property";

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
type FileState = {
  path: string;
  files: Record<string, string>;
  modes?: Record<string, number>;
  links?: Record<string, string>;
};
// One failing workspace-file state per errno class the port maps (ENOENT,
// ENOTDIR, EISDIR, ELOOP, EACCES), at the step that meets it: realPath (path
// resolution) or readFile. The seed varies names and nesting depth.
function fileStates(seed: number): FileState[] {
  const dir = Array.from({ length: seed % 3 }, (_, i) => `d${seed}-${i}/`).join("");
  const query = "query { viewer { id } }";
  const keep = { [`${dir}keep.graphql`]: query };
  return [
    { path: `${dir}missing-${seed}.graphql`, files: keep },
    { path: `${dir}absent-${seed}/query.graphql`, files: keep },
    {
      path: `${dir}dangling-${seed}.graphql`,
      files: keep,
      links: { [`${dir}dangling-${seed}.graphql`]: `nowhere-${seed}.graphql` },
    },
    {
      path: `${dir}blocked-${seed}/query.graphql`,
      files: { ...keep, [`${dir}blocked-${seed}`]: "not a directory" },
    },
    { path: `${dir}folder-${seed}`, files: { ...keep, [`${dir}folder-${seed}/child`]: query } },
    {
      path: `${dir}loop-${seed}.graphql`,
      files: keep,
      links: { [`${dir}loop-${seed}.graphql`]: `loop-${seed}.graphql` },
    },
    {
      path: `${dir}locked-${seed}/query.graphql`,
      files: { ...keep, [`${dir}locked-${seed}/query.graphql`]: query },
      modes: { [`${dir}locked-${seed}`]: 0o000 },
    },
    {
      path: `${dir}unreadable-${seed}.graphql`,
      files: { ...keep, [`${dir}unreadable-${seed}.graphql`]: query },
      modes: { [`${dir}unreadable-${seed}.graphql`]: 0o000 },
    },
  ];
}

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
      // A mutation on a missing entity is Linear's input error, never a created one.
      make(
        "comment-nonmember",
        ["issue", "comment", `ENG-${900000 + seed}`, "--body", "Ready", "--json"],
        1,
      ),
      make(
        "comment-nonmember-uuid",
        [
          "issue",
          "comment",
          `00000000-0000-4000-8000-${String(900000 + seed).padStart(12, "0")}`,
          "--body",
          "Ready",
          "--json",
        ],
        1,
      ),
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
      ...fileStates(seed).map((file, i) => ({
        ...make(`file-${i}`, ["api", "graphql", "--query-file", file.path], 1, file.files),
        modes: file.modes,
        links: file.links,
      })),
    ];
  }
  if (phase === "L4")
    return uploadCases(seed).map((u, i) => ({
      ...make(`upload-${i}`, ["file", "download", u.url, "--json"], u.status),
      declared: u.declared ? "q101" : undefined,
    }));
  throw new Error(`Unknown regression phase ${phase}`);
}
