// A seeded grammar over WHATWG URL components for `file download`. The oracle
// is the original's own parser (Bun's URL.parse, as the TypeScript CLI used
// it); the run compares the native CLI with that CLI's recorded output
// (parity/frozen) on every case it accepts or refuses. Cases the owner declared
// refused (q101: non-empty user information, a port other than 443) are checked
// against the exact refusal line instead, because offline the original could
// not reach them.
const target = "uploads.linear.app";

export type UploadCase = { url: string; status: number; declared: boolean };

// Every byte class that a WHATWG encode set treats differently: C0 controls,
// space, the path/query/fragment set members, an escape, a stray "%", DEL and
// non-ASCII. Tab, CR and LF inside the input are removed by the parser.
const pool = [
  "\u0001",
  "\u001f",
  " ",
  '"',
  "<",
  ">",
  "^",
  "`",
  "{",
  "}",
  "|",
  "[",
  "]",
  "'",
  "\\",
  "%41",
  "%2e",
  "%zz",
  "%",
  "\u007f",
  "é",
  "😀",
  "\t",
  "\r",
  "\n",
  "~",
  "!",
  "$",
  "&",
  "(",
  "=",
  "+",
  ";",
  ":",
  "@",
  ",",
];
const segments = [".", "..", "%2e", ".%2E", "%2E%2e", "a", "b.txt"];

let mapped: Map<string, string[]> | undefined;
// Code points that WHATWG host parsing maps onto a letter or dot of the host.
function hostSpellings(): Map<string, string[]> {
  if (mapped) return mapped;
  mapped = new Map();
  for (let cp = 0x80; cp < 0x1f200; cp++) {
    if (cp >= 0xd800 && cp <= 0xdfff) continue;
    const url = URL.parse(`https://x${String.fromCodePoint(cp)}x/`);
    const middle = url?.hostname.slice(1, -1);
    if (!url || url.pathname !== "/" || !middle || middle.length !== 1 || !target.includes(middle))
      continue;
    mapped.set(middle, [...(mapped.get(middle) ?? []), String.fromCodePoint(cp)]);
  }
  return mapped;
}
const ignored = ["\u00ad", "\u200b", "\u034f", "\ufe0f"];
const encode = (c: string, lower: boolean) =>
  [...new TextEncoder().encode(c)]
    .map(
      (b) =>
        `%${lower ? b.toString(16).padStart(2, "0") : b.toString(16).toUpperCase().padStart(2, "0")}`,
    )
    .join("");

export function uploadCases(seed: number): UploadCase[] {
  let state = seed >>> 0;
  const next = () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0);
  const pick = <T>(xs: T[]) => xs[next() % xs.length]!;
  const spellings = hostSpellings();
  const hostVariants: ((i: number) => string)[] = [
    () => target,
    // ASCII case
    () => [...target].map((c) => (next() % 2 ? c.toUpperCase() : c)).join(""),
    // percent-escapes of host bytes, either hex case
    () => [...target].map((c) => (next() % 3 ? c : encode(c, next() % 2 === 0))).join(""),
    // UTS #46 mapped spellings, raw or escaped as UTF-8
    () =>
      [...target]
        .map((c) => {
          if (next() % 3) return c;
          const s = pick(spellings.get(c) ?? [c]);
          return next() % 2 ? s : encode(s, false);
        })
        .join(""),
    // ignored code points between labels
    () => target.replace(".", `${pick(ignored)}.`),
    // hosts that are not the upload host
    () =>
      pick([
        `${target}.`,
        `${target}.example`,
        "uploads-linear.app",
        `%zz${target}`,
        "uploads%2Flinear.app",
        `${target}%00`,
        "[::1]",
        `xn--${target}`,
        "",
      ]),
  ];
  const userinfos = ["", "", "", "@", ":@", "u@", "u:p@", "@@", "::@"];
  const ports = ["", "", "", ":", ":443", ":0443", ":00443", ":8443", ":0", ":443x", ":65536"];
  const cases: UploadCase[] = [];
  // The first pool.length cases are accepted spellings of the upload origin,
  // so path, query and fragment each meet every pool class in an accepted URL
  // for every seed; the rest draw every component freely, refusals included.
  // The two cases after the covering ones are q101 inputs on an accepted host.
  const authority = (i: number) => {
    const covering = i < pool.length;
    const q101 = i - pool.length;
    const host =
      covering || q101 < 2
        ? hostVariants[i % (hostVariants.length - 1)]!(i)
        : pick(hostVariants)(i);
    let userinfo = i % 3 === 0 ? pick(covering ? userinfos.slice(0, 5) : userinfos) : "";
    let port = i % 4 === 1 ? pick(covering ? ports.slice(0, 7) : ports) : "";
    if (q101 === 0) userinfo = pick(userinfos.slice(5));
    if (q101 === 1) [userinfo, port] = ["", pick([":8443", ":0", ":80", ":00080"])];
    return `${userinfo}${host}${port}`;
  };
  for (let i = 0; i < pool.length + 24; i++) {
    const covering = i < pool.length;
    const scheme = [..."https:"].map((c) => (next() % 4 ? c : c.toUpperCase())).join("");
    const slashes = Array.from({ length: next() % 4 }, () => pick(["/", "\\"])).join("");
    const auth = authority(i);
    const parts = Array.from({ length: 1 + (next() % 3) }, () => pick(segments));
    parts.push(`f${seed}-${pool[i % pool.length]}${pick(pool)}.txt`);
    let url = `${scheme}${slashes}${auth}/${parts.join(pick(["/", "\\"]))}`;
    if (covering || next() % 2)
      url += `?q${pool[(i * 7) % pool.length]}${pick(pool)}${pick(["?", "/", ""])}`;
    if (covering || next() % 2)
      url += `#h${pool[(i * 11) % pool.length]}${pick(pool)}${pick(["#", "?", ""])}`;
    if (i % 6 === 2) url = `${pick([" ", "\u0001", "\n"])}${url}${pick([" ", "\u001f", "\t"])}`;
    cases.push(oracle(url));
  }
  return cases;
}

// The original's own parser decides: accepted (status 0), refused (1), or
// accepted by the original but refused under q101.
function oracle(url: string): UploadCase {
  const parsed = URL.parse(url);
  const accepted = parsed?.protocol === "https:" && parsed.hostname === target;
  const declared = Boolean(accepted && (parsed!.username || parsed!.password || parsed!.port));
  return { url, status: accepted && !declared ? 0 : 1, declared };
}

// The exact refusal the native CLI prints for a q101 URL; the TS original
// prints this same line for every URL its parser refuses.
export const refusal = (url: string) =>
  `Invalid input: Invalid upload URL: ${url}. Expected https://${target}/...\n`;
