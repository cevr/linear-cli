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

L0 schema validation is a prerequisite, not proof of API parity.
