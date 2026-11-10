# Parity mutant ledger

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
