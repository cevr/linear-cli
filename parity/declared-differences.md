# Declared differences

These are the plan's approved limits, not automatic exclusions of failing cases.

- Help text and usage-error layout use Ergo std `flag`; failure status remains 1.
- Effect CLI `--wizard`, `--completions`, and `--log-level` are not ported.
- Text after `Invalid GraphQL document: ` is the port parser's diagnostic.
- JSON escapes U+2028 and U+2029. Record keys otherwise retain construction order.
- Human table width is measured in UTF-16 units, matching JavaScript.
- The native client sends smaller documents and may make fewer requests; semantic
  mutation inputs, output and token reach must still agree.

Downloads (L4), interactive input (L5), TOML config (L6), installation switch and
performance receipts (L7) are not native-parity claims of L1–L3. They remain on
the TypeScript implementation. No installed command is changed by this branch.
