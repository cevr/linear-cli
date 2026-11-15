# Parity mutant ledger

## TypeScript CLI removed (owner, 2026-11-15)

The TypeScript source, the `LINEAR_IMPL` switch and `parity/switch.ts` are
gone. Where an entry below names the TS control, binary or process, the
comparison is now against that program's recorded output (`parity/cases`,
`parity/frozen`); every product and fake mutant below runs unchanged against
the records.

- Retired with the switch: the L4b, L5, L6 and L7 switch mutants
  (`config-create-routes-to-ergo`, `override-ignored`, `shim-loses-argument`,
  `interactive-routes-to-ts`, `auth-routes-to-ts`, `create-routes-to-ts`,
  `default-still-ts`, `effect-flag-still-ts`, `missing-native-falls-back`): no
  program is left to route to. `root-version-undeclared` now runs through
  `parity/version.ts`.
- Retired with the TypeScript preload: `preload-allows-real-host`. The native
  parity entry's loopback-only origins remain, and every case still fails when
  the storage listener sees a credential.
- `fake-forgets-created-issue` and `fake-forgets-created-comment` ran the
  TypeScript record leg against the broken fake, which read the created
  entity back and met the schema's refusal. The port does not read it back,
  so the runner now checks the fake world after a successful `issue create`
  (as before) and `issue comment` (new; case `comment-json`), and that check
  kills both.
- `frozen-unused-record-ignored`, `frozen-missing-record-ignored`
  (`parity/mutants.ts`, verifier follow-up T1): `parity/frozen.ts` stops
  failing a full run on a record no case reached, or stops failing a case
  that has no record. The guards edit a copy's L0 records: an extra entry
  must fail the full run with `records no case reached`, and a removed entry
  must fail its case with `no frozen reference for`. Both guards are checked
  on the real `frozen.ts` first. No existing run edits the records, so
  nothing else reaches these checks.
- New in `parity/launcher.ts`: `checkout-binary-ignored` (a source checkout's
  `bin/linear-ergo` is skipped) and `impl-switch-kept` (`LINEAR_IMPL=ts` still
  selects another program).

## Round 3 (declared before the guards)

- `fake-comment-on-missing-issue`: commentCreate records and returns a comment for an issue id the world does not hold. The L0 mutation-reference property (every id-taking mutation input, generated member and nonmember ids) requires Linear's input error and no recorded mutation; the lookup-root property never sends a mutation. Siblings on the same rule: `fake-archives-missing-issue`, `fake-creates-under-missing-reference`, `fake-records-before-resolving` (issueUpdate records before it resolves its references).
- `query-file-realpath-denied-unknown`: drop the `permission denied` arm of `platformKind`. The generated L3 file state "path through a mode-000 directory" compares realPath bytes with the TS control; no earlier state was permission-denied.
- `query-file-denied-unknown`: the readFile `fs.Denied` arm prints `Unknown`. The generated L3 state "mode-000 file" compares readFile bytes.
- `upload-query-quote-raw`, `upload-fragment-tick-raw`, `upload-path-tick-raw`, `upload-path-caret-raw`, `upload-inner-tab-kept`: drop one member of a WHATWG encode set, or keep an inner tab. The generated L4 URL grammar puts every byte class in path, query and fragment of an accepted URL for every seed; the old 13-URL list reached none of them.
- `upload-empty-userinfo-refused`, `upload-host-escape-kept`, `upload-host-unmapped`: refuse `@`/`:@`, skip host percent-decoding, or skip UTS #46 mapping. The grammar's host and user-information variants are accepted by the original.
- `upload-userinfo-accepted`, `upload-other-port-accepted`: accept a q101 input. Each seed has one non-empty user information and one non-443 port on an accepted host; the run requires exactly the refusal line.

## Round 2 regressions (declared before the guards)

- `fake-invents-missing-root`: remove the missing-root boundary and let SDK scalar defaults invent an entity. Generated member/nonmember lookups against fixture membership require GraphQL null propagation and errors. Existing stable records compare two callers of the same broken fake.
- `fake-forgets-created-comment`: do not retain a successful commentCreate result in the fixture world. Reuse the existing generated `seed-1002-comment` case (an initially empty comment collection); the compiled/source SDK's lazy root lookup must succeed after creation. Root null propagation exposes this older fake defect; no new test is added.
- `text-overtrims-next-line`: classify U+0085 as blank (the old Go TrimSpace behavior). The Unicode model compares the public validator and strict CLI title/comment results against ECMAScript whitespace, including every whitespace class and mixed strings. Existing CreateReadyTitle accepts any rejection, so it misses over-rejection.
- `variables-malformed-loses-schema-error`, `variables-kind-loses-schema-error`: drop the exact JSON parse/kind failure detail. Generated malformed JSON and non-object JSON are strict process comparisons to the compiled TS control; earlier raw cases only supply valid objects.
- `query-file-loses-platform-detail`: replace the workspace-file error with a generic line. Generated missing components, non-directory components and directory reads compare exact bytes/status to the TS binary; the old escape case covers only a successful realpath outside the workspace.
- `upload-rejects-default-port`: refuse an explicit HTTPS default port. Accepted-origin variants compare canonical URL, files and status to the TS binary, paired with the existing foreign-origin law. Earlier downloads all use an already canonical URL.

## Seams

- SDK documents → public schema: catches a fake that accepts invalid SDK requests. Does not test real API behavior.
- Isolated CLI process → fake GraphQL service: catches output, exit, pagination, mutation and token-routing changes. Does not test Linear itself.
- Skill commands → case manifest: catches missing command coverage. Does not claim interactive parity before L5.

## L0 guards

- `schema-accepts-unknown-field`: change `Team.key` to `Team.nonexistentPilotField` in an SDK document. The schema validation probe must reject it. Existing tests replace LinearService and do not validate SDK requests.
- `preload-allows-real-host`: allow a third HTTPS origin. The offline transport guard must reject it before fetch.
- `runner-uses-owner-home`: omit isolated HOME. The runner must assert that HOME equals its case directory before launch.
- `dry-run-sends-mutation`: let dry runs send writes. Recorded mutation logs must be empty.
- `coverage-ignores-flags`: remove every case of a skill's flag combination. Coverage must reject the missing invocation, not just count leaf names.
- `read-flag-loads-every-relation`: load and print children/comments/relations even when their individual flag is absent. The individual read cases distinguish that from the all-flags case.
- `native-ignores-disposition`: a native downloader ignores plain or encoded
  Content-Disposition. The two download-disposition cases carry the original
  helper tests across the process boundary; TS-only unit tests cannot kill a
  mutation in the future native downloader.

L0 schema validation is a prerequisite, not proof of API parity.

## L1 guards

- `http-accepts-empty-team-identity`: a schema-valid but empty id/key crosses
  the wire unchecked. Tracker.IdentityFields over generated in-memory HTTP
  responses rejects it; the fixed CLI corpus contains only real-shaped ids.

- `memory-keeps-empty-identity`: include a fixture team with an empty id or key.
  `Tracker.IdentityFields` runs on generated constructor inputs, including empty
  strings. The fixed process corpus does not exercise invalid memory fixtures.
- `http-stops-at-first-page`: omit the next-page loop. The schema-backed team
  and project cases plus generated page sizes lose data.
- `ship-origin-override`: read a transport-origin environment variable in the
  production entry. The fixed-origin source/build review must reject it.

# L2 guards (declared before implementation)

- `selector-url-loses-key`: URLAndIdentifierAgree at the pure checked-construction seam. Existing L1 laws cover no selectors.
- `issue-connection-first-page`: native-vs-TypeScript generated read comparison with multi-page labels, comments, children and both relation directions. Existing L1 pagination guard covers teams only.
- `read-flags-load-every-relation`: existing fixed single-flag read cases check omission independently; generated all-flags cases alone cannot catch this.
- `bulk-view-keeps-last`: existing multi-id native comparison checks retention and input order, independent of completion order.

# L3 guards (declared before implementation)

- `create-machine-accepts-blank-title`: generated CreateReadyTitle law; existing creation cases use nonblank titles and cannot catch it.
- `graphql-string-is-mutation`: generated query/parser property keeps mutation text inside a string or comment inert; existing raw-query cases contain no such text.
- `graphql-skips-later-operation`: generated multi-operation parser property detects a mutation after a query/fragment; existing corpus uses one operation per document.
- `graphql-rejects-schema-definition`: the same generated property includes type-system syntax and descriptions. Schema fields named mutation are not executable mutation definitions; existing raw CLI cases contain only executable documents.
- `dry-run-sends-mutation`, `workspace-allows-symlink-escape`: reuse existing process cases; no duplicate unit rows.
- `fake-forgets-created-issue`: record leg must observe the created issue's identity in the fake world. L0's stable recordings alone allowed the fake's non-null default `fixture` to mask a missing created-issue lookup.

# L4 guards (declared before implementation)

- `upload-url-host-prefix`: the upload prefix check loses its final `/`, so `https://uploads.linear.app.example/...` names another host. Generated UploadURLKeepsOrigin; the fixed foreign-host case uses an unrelated host and cannot catch it.
- `safe-name-empty-fallback`: a name that cleans to nothing stays empty, so the target is the output folder itself. Generated SafeNameStaysInOutputDir; no fixed case has an all-dot or empty name.
- `unique-name-no-loop`: the suffix stops at `-2` even when `-2` is taken. Generated UniqueNameIsFresh; the fixed duplicate case has only two equal names.
- `native-ignores-disposition`: declared at L0; the download-disposition cases kill it.
- `overwrite-ignored`: an existing file is replaced without `--overwrite`. The download-exists case.
- `upload-credential-wrong-origin`: the token is bound to an origin that is not the upload origin, so it is never sent. The fake upload origin now answers 401 without the token, as the real one does; the download-redirect case.
- `saved-text-drops-size`: the text form of saved files. Every fixed download case prints JSON; the generated `seed-N-download` case alternates text and JSON.
- Token reach: every case fails when the storage listener sees `Authorization`. The token is a CU5 credential of one origin; the port has no public value of it to leak (package `credential` alone reads it), so no port mutant can send it elsewhere. The std http two-peer model owns that guarantee.

# L4b switch mutants

New public seam: execute a copied shim with two inert sibling executables in an
isolated HOME. It observes selected implementation, exact argv and exit status;
domain output stays covered by the existing two-program parity corpus.

- `default-routes-interactive-to-ergo`: retired at L5, when `--interactive` reached native parity; replaced by `interactive-routes-to-ts` below.
- `config-create-routes-to-ergo`: admitting create to the parity table must fail the config route check.
- `override-ignored`: ignoring explicit ts must fail the override check.
- `shim-loses-argument`: dropping argv must fail exact argument forwarding.
- `root-version-undeclared`: removing the native root version must fail the isolated `--version` smoke check (no previous native case invokes the root).

No earlier law, property or example executes a switch. Existing repeated-flag,
short-name, explicit-priority and download cases guard the CU1 refactor; no new
domain test is added for already-covered semantics.

# L5 guards (prompts and auth)

New seam: std `term.Script` plays keys to std `prompt` with no terminal; the
prompts draw on an `io.Recorder`. No earlier law, property, case or test reads a
prompt, a picked issue, a saved token or the `open` result. The original's
prompts need a terminal, and its `auth` starts `open`, so the TS record leg
cannot run them; the scripted-key tests in `ergo/cli` and `ergo/credential` are
the Ergo-side record.

- `token-saved-elsewhere`: Save writes another file name. Law `Credentials.SavedIsLoaded` (generated secrets and environments).
- `token-file-not-private`: Save writes the token 0644. Test `SavedTokenIsOwnerOnly`; no law reads a mode.
- `pick-ignores-choice`, `pick-offers-every-issue`: the picked issue is always the first; more than 20 issues are offered. Test `ViewAsksForAnIssue`.
- `pick-skips-unstarted`, `pick-without-issues-prompts`: no fallback to unstarted issues; an empty choice is prompted. Test `StartFallsBackToUnstarted`.
- `create-never-asks-team`, `create-skips-description`: the create machine is not fed from a person. Test `CreateAsksInMachineOrder`.
- `auth-saves-before-verify`, `auth-ignores-open-status`: a refused key is kept; a failed `open` is not reported. Test `AuthChecksBeforeKeeping`.
- `no-terminal-reported-as-cancel`, `view-ignores-interactive`: a prompt with no terminal is reported as a cancel; `--interactive` is ignored. Process case `view-interactive-no-terminal`.
- Switch: `interactive-routes-to-ts` (the flag scan sends `--interactive` to TS again) and `auth-routes-to-ts` (bare `auth` leaves the table).

# L6 guards (config files)

The five config cases were recorded at L0 and run natively from L6. No earlier
law reads the file order.

- `config-global-first`, `config-skips-linear-toml`: the global file wins, or `linear.toml` is not read. Law `ProjectFileFirst` over all 8 presence sets (the fixed cases each hold one file).
- `config-ignored-by-create`: create does not use the configured team. Case `config-global`.
- `config-error-swallowed`: a malformed file reads as no defaults. Case `config-malformed`.
- Switch: `create-routes-to-ts` (create leaves the table; replaces L4b's `config-create-routes-to-ergo`, whose rule is gone).

# L7 guards (declared before the switch change)

The shim process seam now covers every argv, including groups, unknown commands
and unsupported Effect flags. Existing domain cases never select a sibling
binary; the switch probe observes selection, argv and status without network.
The existing corpus also runs through a copied real shim with offline siblings
for default, explicit Ergo and explicit TS; production origins stay fixed.

- `default-still-ts`: unset LINEAR_IMPL selects TS. The all-argv default probe
  fails; earlier routing checks expected TS for groups and unknown commands.
- `effect-flag-still-ts`: the old Effect-only flag scan remains. The default
  opaque-argv probe must select Ergo even for these flags (which Ergo rejects).
- `missing-native-falls-back`: default uses TS when native is absent. The
  missing-native probe must fail nonzero without running TS.
- `override-ignored`, `shim-loses-argument`: retained, now against the single
  default exec. Retire the old table-entry mutants; no table remains.

# Round 4: API-error text and process argv bytes

Public seams: CLI stdout/stderr/status, saved files and mutation observations,
with the compiled TS CLI as control and a loopback HTTP fixture. These check
process decoding and SDK behavior, not a private implementation function.

- `error-authentication-unclassified`: drop Authentication substring recognition;
  generated HTTP-200 error envelopes (L0) must still report Invalid API token.
- `error-401-unclassified`: drop 401 substring recognition; same generator.
- `error-sdk-brace-uncut`: verifier W1, drop the first `": {"` cut; raw query
  `issue(id: {a: 1})` and generated envelopes must differ from TS.
- `error-empty-readable-dropped`: drop an explicitly present empty readable
  message. The SDK filters null/undefined, not empty strings; the generated
  envelopes caught a real parity gap here in round 4.
- `argv-keeps-invalid-bytes`: bypass lossy argv decoding; LUTF8 compares raw
  execve bytes in titles, bodies and upload URLs with the TS process control.
- `argv-replaces-prefix-bytewise`: replace a truncated valid prefix one byte
  at a time; LUTF8 includes multi-byte ill-formed subsequences.
- `fake-not-found-http400`: return 400 on a not-found envelope; the L0
  membership property checks HTTP 200 separately from extension statusCode 400.

Earlier laws and regressions did not reach HTTP-200 auth substrings, SDK brace
text or non-UTF-8 execve argv. No production-only test seam is added.

# DIST2 launcher (declared before the guards)

Public seam: the package launcher's chosen file, argv, status and refusal line,
in the installed layout (`npm/<os>-<arch>/linear`), reached directly, through
npm's relative link and through bun's absolute link behind a second link, under
dash and bash, with a fake `uname` (`bun parity/launcher.ts --mutants`). No
earlier probe ran the package layout: `switch.ts` covers the source checkout.

- `arch-x64-as-arm64`: x86_64 maps to arm64; the route check runs the wrong file.
- `arch-aarch64-unmapped`: Linux's `aarch64` spelling falls out of the map; it is refused.
- `os-darwin-as-linux`: Darwin maps to linux.
- `link-unresolved`: the launcher looks beside the link, not the package; both links fail.
- `relative-link-from-cwd`: a relative link target is read from the working directory, not the link's folder; npm's link fails.
- `unsupported-arch-as-x64`, `unsupported-os-as-linux`: an unknown platform runs some binary instead of the exact refusal line.

`switch.ts`'s `override-ignored` now edits `exec "$bindir/linear-ts" "$@"`: the ts
arm first refuses a missing TS binary (the package ships none).
