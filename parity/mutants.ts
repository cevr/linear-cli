// Mutants run only in generated copies under the pilot's own scratch folder.
import { spawn, spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
// The package version; scripts/version.ts writes the same into the CLI's root.
const packageVersion: string = JSON.parse(
  await readFile(join(root, "package.json"), "utf8"),
).version;
// One owned scratch per pilot step; the default is the original pilot folder.
const scratch = process.env.LINEAR_PARITY_SCRATCH ?? "/tmp/opencode/linear-port";
const compiler = join(scratch, "ergo");
await mkdir(scratch, { recursive: true });
const env = {
  PATH: process.env.PATH ?? "/usr/bin:/bin",
  HOME: scratch,
  GOMAXPROCS: "1",
  GOTOOLCHAIN: process.env.GOTOOLCHAIN ?? "auto",
  GOMEMLIMIT: "6GiB",
  GOFLAGS: "-p=1",
  GOCACHE: join(scratch, "gocache"),
  GOPATH: join(scratch, "go"),
  GOMODCACHE: join(scratch, "go/pkg/mod"),
  LINEAR_PARITY_SCRATCH: scratch,
};

async function run(command: string, args: string[], cwd: string) {
  const child = spawn(command, args, {
    cwd,
    env,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "",
    active = true;
  let force: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    if (active && child.pid) {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        /* already reaped */
      }
      force ??= setTimeout(() => {
        if (active && child.pid) {
          try {
            process.kill(-child.pid, "SIGKILL");
          } catch {
            /* already reaped */
          }
        }
      }, 10_000);
    }
  };
  const timer = setTimeout(stop, 120_000); // only a hung mutant is stopped
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) process.on(signal, stop);
  child.stdout.on("data", (data) => {
    output += data;
  });
  child.stderr.on("data", (data) => {
    output += data;
  });
  try {
    const code = await new Promise<number>((ok, fail) => {
      child.once("error", fail);
      child.once("close", (status, signal) =>
        signal ? fail(new Error(`mutant stopped: ${signal}`)) : ok(status ?? 1),
      );
    });
    return { code, output };
  } finally {
    stop();
    active = false;
    clearTimeout(timer);
    if (force) clearTimeout(force);
    for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) process.off(signal, stop);
    const ps = spawnSync("ps", ["-eo", "pid,pgid,stat,comm"], { encoding: "utf8" });
    const remains = ps.stdout.split("\n").filter((line) => {
      const fields = line.trim().split(/\s+/);
      return fields[1] === String(child.pid) && !fields[2]?.startsWith("Z");
    });
    if (remains.length) console.error(`owned processes remain: ${remains.join("; ")}`);
    if (remains.length || ps.status !== 0) process.exitCode = 1;
  }
}

type Mutant = {
  name: string;
  file: string;
  from: string;
  to: string;
  pkg: string;
  guard: string;
  args?: string[];
  version?: boolean;
};
const mutants: Mutant[] = [
  {
    name: "error-empty-readable-dropped",
    file: "graphqlhttp/client.ergo",
    from: "if readable != raw { parts = parts.Append(readable) }",
    to: 'if readable != "" && readable != raw { parts = parts.Append(readable) }',
    pkg: "",
    guard: "regression-L0-error-18: parity mismatch",
    args: ["--regressions=L0", "--seed=42"],
  },
  ...(
    [
      [
        "error-authentication-unclassified",
        'strings.Contains(message, "Authentication")',
        'strings.Contains(message, "never-auth")',
      ],
      [
        "error-401-unclassified",
        'strings.Contains(message, "401")',
        'strings.Contains(message, "never-401")',
      ],
      [
        "error-sdk-brace-uncut",
        "if cut >= 0 { raw = raw[:cut] }",
        "if cut < -1 { raw = raw[:cut] }",
      ],
    ] as const
  ).map(([name, from, to]) => ({
    name,
    file: "graphqlhttp/client.ergo",
    from,
    to,
    pkg: "",
    guard: ": parity mismatch",
    args: [
      "--regressions=L0",
      "--seed=42",
      ...(name === "error-sdk-brace-uncut" ? ["--case=regression-L0-error-brace"] : []),
    ],
  })),
  {
    name: "argv-keeps-invalid-bytes",
    file: "cli/run.ergo",
    from: "run(decodedArgs(args)) catch {",
    to: "run(args) catch {",
    pkg: "",
    guard: "regression-LUTF8-title-0: parity mismatch",
    args: ["--regressions=LUTF8", "--seed=42"],
  },
  {
    name: "argv-replaces-prefix-bytewise",
    file: "cli/argv.ergo",
    from: "i = i + width",
    to: "i = i + 1 + width*0",
    pkg: "",
    guard: ": parity mismatch",
    args: ["--regressions=LUTF8", "--seed=42"],
  },
  {
    name: "text-overtrims-next-line",
    file: "linear/write.ergo",
    from: "c == 160 || c == 5760",
    to: "c == 133 || c == 160 || c == 5760",
    pkg: "",
    guard: "regression-L3-title-25: parity mismatch",
    args: ["--regressions=L3", "--case=regression-L3-title-25"],
  },
  {
    name: "variables-malformed-loses-schema-error",
    file: "cli/graphql.ergo",
    from: "--variables must be a JSON object: SchemaError(Expected a valid JSON string)",
    to: "--variables must be a JSON object: invalid JSON",
    pkg: "",
    guard: "regression-L3-variables-0: parity mismatch",
    args: ["--regressions=L3", "--case=regression-L3-variables-0"],
  },
  {
    name: "variables-kind-loses-schema-error",
    file: "cli/graphql.ergo",
    from: "--variables must be a JSON object: SchemaError(Expected object)",
    to: "--variables must be a JSON object",
    pkg: "",
    guard: "regression-L3-variables-7: parity mismatch",
    args: ["--regressions=L3", "--case=regression-L3-variables-7"],
  },
  {
    name: "query-file-loses-platform-detail",
    file: "cli/graphql.ergo",
    from: 'return fileFailure(path, "realPath", absolute, platformKind(e.Text))',
    to: 'return linear.InvalidInput{Message: "Could not read GraphQL query file " + path + strings.Repeat(absolute + e.Text, 0)}',
    pkg: "",
    guard: "regression-L3-file-0: parity mismatch",
    args: ["--regressions=L3", "--case=regression-L3-file-0"],
  },
  {
    name: "query-file-realpath-denied-unknown",
    file: "cli/graphql.ergo",
    from: 'if strings.Contains(reason, "permission denied") { return "PermissionDenied" }',
    to: "",
    pkg: "",
    guard: "regression-L3-file-6: parity mismatch",
    args: ["--regressions=L3", "--seed=1000", "--case=regression-L3-file-6"],
  },
  {
    name: "query-file-denied-unknown",
    file: "cli/graphql.ergo",
    from: 'return fileFailure(path, "readFile", target, "PermissionDenied")',
    to: 'return fileFailure(path, "readFile", target, "Unknown")',
    pkg: "",
    guard: "regression-L3-file-7: parity mismatch",
    args: ["--regressions=L3", "--seed=1000", "--case=regression-L3-file-7"],
  },
  {
    name: "upload-rejects-default-port",
    file: "linear/upload.ergo",
    from: 'if port != "443" && authority[colon+1:] != "" { return invalid }',
    to: 'if port != "443" || authority[colon+1:] != "" { return invalid }',
    pkg: "",
    guard: ": parity mismatch",
    args: ["--regressions=L4", "--seed=42"],
  },
  // Round 3: the generated WHATWG URL property (parity/upload-property.ts).
  ...(
    [
      [
        "upload-query-quote-raw",
        '(component == "query" && c == 39)',
        '(component == "query" && c == 1000)',
      ],
      [
        "upload-fragment-tick-raw",
        '(component == "fragment" && c == 96)',
        '(component == "fragment" && c == 1000)',
      ],
      [
        "upload-path-tick-raw",
        "(c == 94 || c == 96 || c == 123",
        "(c == 94 || c == 1000 || c == 123",
      ],
      [
        "upload-path-caret-raw",
        "(c == 94 || c == 96 || c == 123",
        "(c == 1000 || c == 96 || c == 123",
      ],
      ["upload-inner-tab-kept", 'strings.ReplaceAll(text, "\\t", "")', "text"],
      [
        "upload-empty-userinfo-refused",
        'if userinfo != "" && userinfo != ":" { return invalid }',
        "if userinfo == userinfo { return invalid }",
      ],
      ["upload-host-escape-kept", "if text[i] == '%' && escapeAt(text, i) {", "if false {"],
      [
        "upload-host-unmapped",
        "host = host + m.Value",
        "host = host + utf8.RuneText(c) + m.Value[:0]",
      ],
      ["upload-stray-percent-sent", 'path = path + "%25"', 'path = path + "%"'],
      [
        "upload-userinfo-accepted",
        'if userinfo != "" && userinfo != ":" { return invalid }',
        'if userinfo == "@never@" { return invalid }',
      ],
      [
        "upload-other-port-accepted",
        'if port != "443" && authority[colon+1:] != "" { return invalid }',
        'if port == "x" { return invalid }',
      ],
    ] as const
  ).map(([name, from, to]) => ({
    name,
    file: "linear/upload.ergo",
    from,
    to,
    pkg: "",
    guard: name.endsWith("-accepted") ? ": q101 refusal mismatch" : ": parity mismatch",
    args: ["--regressions=L4", "--seed=42"],
  })),
  {
    name: "root-version-undeclared",
    file: "cli/arguments.ergo",
    from: `Version: Some[string]{Value: "linear v${packageVersion}"}`,
    to: "Version: None",
    pkg: "",
    guard: "root-version-undeclared: version differs",
    version: true,
  },
  {
    name: "graphql-rejects-schema-definition",
    file: "graphql/schema.ergo",
    from: 'if token.Text == "schema" {',
    to: "if false {",
    pkg: "graphql",
    guard: "FAIL law MutationIsAnOperation",
  },
  {
    name: "create-machine-accepts-blank-title",
    file: "linear/write.ergo",
    from: 'let text = try ValidateText("Issue title", title.Text, 255, false)',
    to: "let text = title.Text",
    pkg: "linear",
    guard: "law refuted",
  },
  {
    name: "graphql-string-is-mutation",
    file: "graphql/document.ergo",
    from: "let mut mutation = false",
    to: 'let mut mutation = strings.Contains(text, "mutation")',
    pkg: "graphql",
    guard: "law refuted",
  },
  {
    name: "graphql-skips-later-operation",
    file: "graphql/document.ergo",
    from: 'mutation = mutation || token.Text == "mutation"',
    to: 'mutation = mutation || (count == 0 && token.Text == "mutation")',
    pkg: "graphql",
    guard: "law refuted",
  },
  {
    name: "dry-run-sends-mutation",
    file: "cli/write.ergo",
    from: "let started = try linear.PlanStart(id)",
    to: "let started = try linear.PlanStart(id)\n\ttry linear.Writer.Start(started.Issue.Id, started.State.Id)",
    pkg: "",
    guard: "dry-run-sends-mutation survived",
    args: ["--phase=3", "--case=start-dry"],
  },
  {
    name: "workspace-allows-symlink-escape",
    file: "cli/graphql.ergo",
    from: 'if relative == ".." || strings.HasPrefix(relative, "../") || filepath.IsAbs(relative) {',
    to: 'if (relative == ".." || strings.HasPrefix(relative, "../") || filepath.IsAbs(relative)) && false {',
    pkg: "",
    guard: "expected exit 1, got 0",
    args: ["--phase=3", "--case=graphql-file-escape"],
  },
  {
    name: "memory-keeps-empty-identity",
    file: "memory/tracker.ergo",
    from: 'if team.Id != "" && team.Key != "" {',
    to: "if true {",
    pkg: "memory",
    guard: "law refuted",
  },
  {
    name: "http-accepts-empty-team-identity",
    file: "graphqlhttp/client.ergo",
    from: 'if n.Id == "" || n.Key == "" {',
    to: "if false {",
    pkg: "graphqlhttp",
    guard: "law refuted",
  },
  {
    name: "http-stops-at-first-page",
    file: "graphqlhttp/client.ergo",
    from: "if !data.Teams.PageInfo.HasNextPage {",
    to: "if true {",
    pkg: "",
    guard: "parity mismatch",
  },
  {
    name: "selector-url-loses-key",
    file: "linear/selector.ergo",
    from: "return Selector{value: parts[2]}",
    to: 'return Selector{value: "WRONG-1"}',
    pkg: "linear",
    guard: "law refuted",
  },
  {
    name: "issue-connection-first-page",
    file: "graphqlhttp/issue.ergo",
    from: "if !data.Issue.Items.PageInfo.HasNextPage {",
    to: "if true {",
    pkg: "",
    guard: "parity mismatch",
    args: ["--phase=2", "--property=1000", "--case=seed-1000-view"],
  },
  {
    name: "read-flags-load-every-relation",
    file: "graphqlhttp/issue.ergo",
    from: "if options.Relations {",
    to: "if true {",
    pkg: "",
    guard: "parity mismatch",
    args: ["--phase=2", "--case=view-json"],
  },
  {
    name: "bulk-view-keeps-last",
    file: "cli/issue.ergo",
    from: "selectors = selectors.Append(try linear.ParseSelector(id))",
    to: "selectors = []linear.Selector{try linear.ParseSelector(id)}",
    pkg: "",
    guard: "parity mismatch",
    args: ["--phase=2", "--case=view-bulk-three"],
  },
  {
    name: "upload-url-host-prefix",
    file: "linear/upload.ergo",
    from: 'if h.Value != "uploads.linear.app" { return invalid }',
    to: 'if !strings.HasPrefix(h.Value, "uploads.linear.app") { return invalid }',
    pkg: "linear",
    guard: "law refuted",
  },
  {
    name: "safe-name-empty-fallback",
    file: "files/name.ergo",
    from: 'if cleaned == "" { return "download" }',
    to: 'if false { return "download" }',
    pkg: "files",
    guard: "law refuted",
  },
  {
    name: "unique-name-no-loop",
    file: "files/name.ergo",
    from: 'for taken(used, stem+"-\\(n)"+ext) {',
    to: 'if false && taken(used, stem+"-\\(n)"+ext) {',
    pkg: "files",
    guard: "law refuted",
  },
  {
    name: "native-ignores-disposition",
    file: "files/name.ergo",
    from: "nonEmpty(DispositionName(d.Value))",
    to: 'if d.Value == "" { DispositionName("") } else { DispositionName("") }',
    pkg: "",
    guard: "parity mismatch",
    args: ["--phase=4", "--case=download-disposition-plain"],
  },
  {
    name: "overwrite-ignored",
    file: "files/save.ergo",
    from: "if present && !overwrite {",
    to: "if present && !overwrite && false {",
    pkg: "",
    guard: "expected exit 1, got 0",
    args: ["--phase=4", "--case=download-exists"],
  },
  {
    name: "upload-credential-wrong-origin",
    file: "uploadhttp/upload.ergo",
    from: "credential.Bind(token, r.origin)",
    to: 'credential.Bind(token, "http://127.0.0.1:1")',
    pkg: "",
    guard: "expected exit 0, got 1",
    args: ["--phase=4", "--case=download-redirect"],
  },
  {
    name: "saved-text-drops-size",
    file: "cli/files.ergo",
    from: 'io.Stdout.Println("Saved " + s.Path + " (\\(s.Bytes) bytes)")',
    to: 'io.Stdout.Println("Saved " + s.Path)',
    pkg: "",
    guard: "parity mismatch",
    args: ["--phase=4", "--property=1000", "--case=seed-1000-download"],
  },
  // L5: prompts (scripted keys over std term's Script) and auth.
  {
    name: "token-file-not-private",
    file: "credential/token.ergo",
    from: "t.value, fs.Private())",
    to: "t.value, fs.Shared())",
    pkg: "credential",
    guard: "SavedTokenIsOwnerOnly",
  },
  {
    name: "token-saved-elsewhere",
    file: "credential/token.ergo",
    from: 'f.writes.WriteFileMode(filepath.Join([]string{folder(f), "token"})',
    to: 'f.writes.WriteFileMode(filepath.Join([]string{folder(f), "token.json"})',
    pkg: "credential",
    guard: "law refuted",
  },
  {
    name: "pick-ignores-choice",
    file: "cli/interactive.ergo",
    from: 'shown[try prompt.Select("Select an issue", labels)].Identifier',
    to: 'shown[0 * (try prompt.Select("Select an issue", labels))].Identifier',
    pkg: "cli",
    guard: "ViewAsksForAnIssue",
  },
  {
    name: "pick-offers-every-issue",
    file: "linear/session.ergo",
    from: "issues[:if len(issues) < 20 { len(issues) } else { 20 }]",
    to: "issues[:len(issues)]",
    pkg: "cli",
    guard: "ViewAsksForAnIssue",
  },
  {
    name: "pick-skips-unstarted",
    file: "cli/interactive.ergo",
    from: 'if len(issues) == 0 { issues = try linear.Reader.MyIssues(Some[string]{Value: "unstarted"}, 50) }',
    to: 'if false { issues = try linear.Reader.MyIssues(Some[string]{Value: "unstarted"}, 50) }',
    pkg: "cli",
    guard: "StartFallsBackToUnstarted",
  },
  {
    name: "pick-without-issues-prompts",
    file: "linear/session.ergo",
    from: 'if len(issues) == 0 { return NoIssues{Message: "No issues found to select from."} }',
    to: 'if false { return NoIssues{Message: "No issues found to select from."} }',
    pkg: "cli",
    guard: "StartFallsBackToUnstarted",
  },
  {
    name: "create-never-asks-team",
    file: "cli/write.ergo",
    from: "try chooseTeam(teams, selector, asking)",
    to: "try chooseTeam(teams, selector, false)",
    pkg: "cli",
    guard: "CreateAsksInMachineOrder",
  },
  {
    name: "create-skips-description",
    file: "cli/write.ergo",
    from: '} else if asking { try prompt.Line("Description',
    to: '} else if false { try prompt.Line("Description',
    pkg: "cli",
    guard: "CreateAsksInMachineOrder",
  },
  {
    name: "auth-saves-before-verify",
    file: "cli/interactive.ergo",
    from: "let viewer = try linear.Sessions.Verify(token)\n\ttry credential.Credentials.Save(token)",
    to: "try credential.Credentials.Save(token)\n\tlet viewer = try linear.Sessions.Verify(token)",
    pkg: "cli",
    guard: "AuthChecksBeforeKeeping",
  },
  {
    name: "auth-ignores-open-status",
    file: "cli/interactive.ergo",
    from: "result.Status == 0",
    to: "result.Status == 0 || true",
    pkg: "cli",
    guard: "AuthChecksBeforeKeeping",
  },
  {
    name: "no-terminal-reported-as-cancel",
    file: "cli/run.ergo",
    from: 'Message: "Invalid input: prompts need a terminal on standard input"',
    to: 'Message: "Cancelled"',
    pkg: "",
    guard: "no-terminal refusal lost its message or status",
    args: ["--phase=5", "--case=view-interactive-no-terminal"],
  },
  {
    name: "view-ignores-interactive",
    file: "cli/issue.ergo",
    from: 'command == "view" && enabled(interactiveFlag, v)',
    to: 'command == "view" && false',
    pkg: "",
    guard: "no-terminal refusal lost its message or status",
    args: ["--phase=5", "--case=view-interactive-no-terminal"],
  },
  // L6: config files through std toml.
  {
    name: "config-global-first",
    file: "tomlconfig/config.ergo",
    from: "for path in Candidates(f) {",
    to: "for path in []string{Candidates(f)[2], Candidates(f)[0], Candidates(f)[1]} {",
    pkg: "tomlconfig",
    guard: "ProjectFileFirst",
  },
  {
    name: "config-skips-linear-toml",
    file: "tomlconfig/config.ergo",
    from: 'filepath.Join([]string{f.cwd, "linear.toml"}), ',
    to: "",
    pkg: "tomlconfig",
    guard: "ProjectFileFirst",
  },
  {
    name: "config-ignored-by-create",
    file: "cli/write.ergo",
    from: "} else { configured }",
    to: "} else { None }",
    pkg: "",
    guard: "expected exit 0, got 1",
    args: ["--phase=6", "--case=config-global"],
  },
  {
    name: "config-error-swallowed",
    file: "tomlconfig/config.ergo",
    from: "return try parse(path, text.Value)",
    to: "return parse(path, text.Value) catch {\n\t\t\tcase _:\n\t\t\t\tlinear.Defaults{TeamId: None}\n\t\t\t}",
    pkg: "",
    guard: "config failure lost its kind or path",
    args: ["--phase=6", "--case=config-malformed"],
  },
];
// --only=<name> runs one mutant while a phase is built; the gate runs all.
const only = process.argv.find((arg) => arg.startsWith("--only="))?.slice("--only=".length);
for (const mutant of mutants) {
  if (only && mutant.name !== only) continue;
  const dir = await mkdtemp(join(scratch, "mutant-"));
  const module = join(dir, "ergo");
  await cp(join(root, "ergo"), module, { recursive: true });
  const path = join(module, mutant.file);
  const source = await readFile(path, "utf8");
  if (source.split(mutant.from).length !== 2) throw new Error(`${mutant.name}: edit is not unique`);
  await writeFile(path, source.replace(mutant.from, mutant.to));
  let result: { code: number; output: string };
  if (mutant.pkg) {
    result = await run(compiler, ["test", join(module, mutant.pkg), "--seed", "42"], root);
  } else {
    const binary = join(dir, "linear-mutant");
    const built = await run(
      compiler,
      ["build", join(module, mutant.version ? "cmd/linear" : "cmd/linear-parity"), "-o", binary],
      root,
    );
    if (built.code !== 0) throw new Error(`${mutant.name}: invalid mutant build: ${built.output}`);
    result = await run(
      process.execPath,
      [
        join(root, mutant.version ? "parity/switch.ts" : "parity/run.ts"),
        ...(mutant.version
          ? [`--native=${binary}`]
          : [
              ...(mutant.args ?? ["--phase=1", "--seed=42", "--case=seed-42-team"]),
              `--binary=${binary}`,
            ]),
      ],
      root,
    );
  }
  if (result.code === 0 || !result.output.includes(mutant.guard))
    throw new Error(`${mutant.name}: survived or failed for the wrong reason: ${result.output}`);
  console.log(`killed ${mutant.name}: ${mutant.guard}`);
}
// Fixture-fake mutants: each is killed by the L0 membership properties.
const fakeMutants = [
  {
    name: "fake-not-found-http400",
    from: "return Response.json(result, { status: 200 });",
    to: "return Response.json(result, { status: result.errors ? 400 : 200 });",
    guard: "fake-mutates-missing-reference:",
  },
  {
    name: "fake-invents-missing-root",
    from: 'if (parent === "Query") return null;',
    to: "/* let the fallback invent a root */",
    guard: "fake-invents-missing-root:",
  },
  {
    name: "fake-comment-on-missing-issue",
    from: 'resolveInput("commentCreate", input);',
    to: "/* accept any comment target */",
    guard: "fake-mutates-missing-reference: seed=42 field=commentCreate.issueId",
  },
  {
    name: "fake-archives-missing-issue",
    from: 'referenced("Issue", id);\n      mutations.push({ operation: "issue.archive"',
    to: 'mutations.push({ operation: "issue.archive"',
    guard: "field=issueArchive.id",
  },
  {
    name: "fake-creates-under-missing-reference",
    from: 'resolveInput("issueCreate", input);',
    to: "/* accept any create references */",
    guard: "field=issueCreate.teamId",
  },
  {
    name: "fake-records-before-resolving",
    from: 'resolveInput("issueUpdate", input);\n      mutations.push({ operation: "issue.update", id: target.id, input });',
    to: 'mutations.push({ operation: "issue.update", id: target.id, input });\n      resolveInput("issueUpdate", input);',
    guard: "field=issueUpdate.teamId",
  },
];
for (const mutant of fakeMutants) {
  if (only && only !== mutant.name) continue;
  const dir = await mkdtemp(join(scratch, "fake-reference-mutant-"));
  await cp(join(root, "parity"), join(dir, "parity"), { recursive: true });
  await symlink(join(root, "node_modules"), join(dir, "node_modules"));
  const path = join(dir, "parity/fake-linear.ts");
  const source = await readFile(path, "utf8");
  if (source.split(mutant.from).length !== 2) throw new Error(`${mutant.name}: edit is not unique`);
  await writeFile(path, source.replace(mutant.from, mutant.to));
  const result = await run(process.execPath, [join(dir, "parity/run.ts"), "--regressions=L0"], dir);
  if (result.code === 0 || !result.output.includes(mutant.guard))
    throw new Error(`${mutant.name} survived or failed for wrong reason: ${result.output}`);
  console.log(`killed ${mutant.name}: L0 membership property`);
}
if (only && !["fake-forgets-created-issue", "fake-forgets-created-comment"].includes(only)) {
  console.log(`EXIT: 0 (mutant ${only} only)`);
  process.exit(0);
}
for (const entity of ["issue", "comment"]) {
  const name = `fake-forgets-created-${entity}`;
  if (only && only !== name) continue;
  const fakeDir = await mkdtemp(join(scratch, "fake-mutant-"));
  await cp(join(root, "parity"), join(fakeDir, "parity"), { recursive: true });
  await symlink(join(root, "src"), join(fakeDir, "src"));
  await symlink(join(root, "node_modules"), join(fakeDir, "node_modules"));
  const fakePath = join(fakeDir, "parity/fake-linear.ts");
  const fakeSource = await readFile(fakePath, "utf8");
  const from = `w.${entity === "issue" ? "issues" : "comments"}.push(created);`;
  if (fakeSource.split(from).length !== 2) throw new Error(`${name}: edit is not unique`);
  await writeFile(fakePath, fakeSource.replace(from, `/* forget created ${entity} */`));
  const fakeResult = await run(
    process.execPath,
    [
      join(fakeDir, "parity/run.ts"),
      "--record",
      "--phase=3",
      ...(entity === "issue"
        ? ["--case=create-json"]
        : ["--seed=1002", "--case=seed-1002-comment"]),
    ],
    fakeDir,
  );
  if (
    fakeResult.code === 0 ||
    !fakeResult.output.includes("expected exit 0, got 1") ||
    !fakeResult.output.includes(`Cannot return null for non-nullable field Query.${entity}.`)
  )
    throw new Error(`${name}: survived or failed for the wrong reason: ${fakeResult.output}`);
  console.log(`killed ${name}: schema refuses missing post-create root`);
}
console.log("EXIT: 0 (selected product and harness mutants killed)");
