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

Prompts and auth (L5):

- Prompts are std `prompt` machines on std `term`. They draw on standard error,
  so standard output holds only the result; the original draws on standard
  output. Frames, colors and key handling are std's: Escape, Ctrl-C and Ctrl-D
  cancel (`Cancelled`, status 1).
- A prompt needs a terminal on standard input. With none, the port fails with
  `Invalid input: prompts need a terminal on standard input` and status 1. The
  original reads keys from the pipe and, at its end, exits 130 with no error line
  (cases `view-interactive-no-terminal`, `create-interactive-no-terminal`).
- An issue choice shows `ID: title - state` on every line; the original shows
  the state only for the highlighted line.
- Interactive create feeds the create machine in its order (team, title,
  description). A rejected title stops before the description is asked; the
  original asks the description and then rejects the title.
- `auth` trims the pasted key before it checks it (the original checks the
  untrimmed key and saves it trimmed). An empty key is
  `Invalid input: API key cannot be empty`. The key is saved only after Linear
  accepts it, 0600, as the original does. The parity entry never starts `open`.
- `auth` reads the bare argv `auth` before the command tree: std flag has no
  command that both runs and has subcommands (neutral gap in the pilot's notes).

TOML config (L6) and performance receipts (L7) are not native-parity claims.
The local switch and its parity table are described in `routing.md`; create
remains TypeScript by default until L6. No installed command is changed by this
branch.
