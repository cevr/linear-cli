# Source-test coverage

This maps the original TypeScript test intents to process cases. A layer-only
test has no literal process equivalent: the cases exercise its public behavior.
The original tests stay unchanged. Names below are public test descriptions.

| Original intent                                       | Process cases                                            |
| ----------------------------------------------------- | -------------------------------------------------------- |
| Issue JSON contains no human text                     | list-json                                                |
| Repeated single-value flag rejected                   | repeated-flag                                            |
| No implicit interactive read                          | view-missing                                             |
| Start preview does not mutate                         | start-dry, expected.mutations                            |
| Missing create title fails before remote choices      | create-missing-title                                     |
| Malformed selector rejected                           | view-bad-selector                                        |
| Query-file symlink cannot escape                      | graphql-file-escape                                      |
| Raw mutation needs consent                            | graphql-mutation-denied                                  |
| Authorized raw mutation runs                          | graphql-mutation                                         |
| Invalid list limit rejected                           | limit-low, limit-high                                    |
| Token from provided layer / no token                  | token-file, no-token                                     |
| Default config / provided config                      | create-one-team, config-global                           |
| Global TOML file, quoting, escapes, comments, CRLF    | config-global, config-quoted                             |
| Malformed TOML / invalid type                         | config-malformed, config-invalid-type                    |
| File token wins over environment                      | token-file-precedence                                    |
| Upload Markdown links and images                      | files-list, files-unsafe-names                           |
| Safe file names                                       | files-unsafe-names                                       |
| Unique suffixes                                       | files-duplicate-names                                    |
| Plain / encoded Content-Disposition                   | download-disposition-plain, download-disposition-encoded |
| Credential reaches upload origin, not redirect target | download-redirect, fake storage-header assertion         |
| Non-success download is tagged failure                | download-notfound                                        |
| Foreign URL refused before sending token              | download-foreign-host                                    |
| Description and comment uploads listed                | files-list                                               |
| Download naming, overwrite refusal and override       | files-download, download-exists, download-overwrite      |
| Comment dry run has no mutation                       | comment-dry, expected.mutations                          |

The manifest remains the corpus source. Record exports each case as `args`,
`env`, `stdin`, `setup.sh`, and the five expected results. Compare rejects export
drift. Setup is applied directly from the same manifest by this runner; the
shell export allows a later Ergo example runner to use the case unchanged.

Hidden-input `auth` and all `--interactive` invocations are explicitly deferred
to L5, not accepted terminal parity. Schema defaults only fill SDK fields which
the application does not print. Fixture fields that the application uses are
explicitly populated or null according to the public schema.
