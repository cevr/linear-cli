# Declared differences

These are the plan's approved limits, not automatic exclusions of failing cases.

- Help text and usage-error layout use Ergo std `flag`; failure status remains 1.
- Effect CLI `--wizard`, `--completions`, and `--log-level` are not ported.
- Text after `Invalid GraphQL document: ` is the port parser's diagnostic.
- JSON escapes U+2028 and U+2029. Record keys otherwise retain construction order.
- Human table width is measured in UTF-16 units, matching JavaScript.
- The native client sends smaller documents and may make fewer requests; semantic
  mutation inputs, output and token reach must still agree.

Downloads (L4):

- An upload URL must start with `https://uploads.linear.app/` (scheme and host in
  any case). The port refuses, instead of normalizing as a WHATWG parser does, a
  port, user information, a backslash, a `.` or `..` path segment, whitespace,
  control or non-ASCII characters, and `"'<>{}` and backquote. The printed `url`
  is then the same text the original prints.
- The original follows one redirect and sends no token on it. The port follows one
  redirect through the std http network policy; the token is a credential of the
  upload origin, so a redirect back to that origin carries it and any other origin
  does not. A second redirect is `Linear API Error: Download failed: more than 1
redirect for URL`, where the original reports the redirect's HTTP status.
- A response body is held in memory up to 64 MiB (67,108,864 bytes); a larger one
  is a `Download failed` API error. The original has no limit.
- Transport failure and `File Error:` texts are the port's own; the prefix and
  exit status 1 are kept.

Interactive input (L5), TOML config (L6) and performance receipts (L7) are not
native-parity claims. The local switch and its conservative parity table are
described in `routing.md`; create and interactive paths remain TypeScript by
default. No installed command is changed by this branch.
